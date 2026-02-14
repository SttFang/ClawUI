import { useCallback, useEffect, useRef } from "react";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { useExecApprovalsStore } from "@/store/execApprovals";
import type { HandOffPayload } from "./execSystemHandoff/types";
import {
  HANDOFF_COOLDOWN_MS,
  HANDOFF_REFRESH_DELAY_MS,
  HISTORY_LIMIT,
  INTERNAL_SYSTEM_KIND,
} from "./execSystemHandoff/constants";
import {
  extractToolCallId,
  isLikelyTerminalResultText,
  parseApprovalEvent,
  parseChatTerminalEvent,
  readHeartbeatExecPreview,
  readToolEventText,
  resolveApprovalHandoff,
} from "./execSystemHandoff/events";
import { pickLastHistoryText } from "./execSystemHandoff/history";
import { hashText, isRecord, normalizeSessionKey, normalizeText } from "./execSystemHandoff/utils";

type ApprovalHandoffContext = {
  approvalId: string;
  source: HandOffPayload["source"];
  sessionKey: string;
  runId?: string;
  command?: string;
  toolCallId?: string;
  approvalAtMs?: number;
  approvalAtMsFromPayload?: boolean;
};

function markExecCommandTerminal(sessionKey: string, command: string, atMs = Date.now()): void {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  const normalizedCommand = command.trim();
  if (!normalizedSessionKey || !normalizedCommand) return;
  const commandKey = `${normalizedSessionKey}::${normalizedCommand}`;
  useA2UIExecTraceStore.getState().setTerminal(commandKey, {
    traceKey: `history-terminal:${atMs}:${commandKey}`,
    endedAtMs: atMs,
    toolOrder: null,
  });
}

function hasSessionApprovalOrRunningContext(sessionKey: string): boolean {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  if (!normalizedSessionKey) return false;

  const state = useExecApprovalsStore.getState();
  const hasPending = state.queue.some(
    (entry) => normalizeSessionKey(entry.request.sessionKey) === normalizedSessionKey,
  );
  if (hasPending) return true;

  return Object.keys(state.runningByKey).some((key) => key.startsWith(`${normalizedSessionKey}::`));
}

function markSessionRunningCommandsTerminal(sessionKey: string, atMs = Date.now()): void {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  if (!normalizedSessionKey) return;
  const runningByKey = useExecApprovalsStore.getState().runningByKey;
  const prefix = `${normalizedSessionKey}::`;
  for (const key of Object.keys(runningByKey)) {
    if (!key.startsWith(prefix)) continue;
    const command = key.slice(prefix.length).trim();
    if (!command) continue;
    markExecCommandTerminal(normalizedSessionKey, command, atMs);
  }
}

function isSystemLikeResultRecord(raw: Record<string, unknown>): boolean {
  const role = typeof raw.role === "string" ? raw.role.trim().toLowerCase() : "";
  return (
    role === "system" ||
    role === "tool" ||
    role === "toolresult" ||
    role === "tool_result" ||
    role === "tool_result_error"
  );
}

function buildApprovalLoopNudgeText(command?: string): string {
  const normalizedCommand = normalizeText(command ?? "");
  return [
    "[internal.exec.approval.allow]",
    "---",
    normalizedCommand ? `command: ${normalizedCommand}` : "command: <unknown>",
    "status: approved",
    "next: continue current run, consume pending exec system events, and respond with final result.",
  ].join("\n");
}

function buildApprovalRetryExhaustedText(payload: HandOffPayload): string {
  const normalizedCommand = normalizeText(payload.command ?? "");
  const normalizedToolCallId = normalizeText(payload.toolCallId ?? "");
  return [
    "[internal.exec.approval.allow.retry_exhausted]",
    "---",
    payload.approvalId ? `approvalId: ${payload.approvalId}` : "approvalId: <unknown>",
    normalizedCommand ? `command: ${normalizedCommand}` : "command: <unknown>",
    normalizedToolCallId ? `toolCallId: ${normalizedToolCallId}` : "toolCallId: <unknown>",
    payload.runId ? `runId: ${payload.runId}` : "runId: <none>",
    "status: approved",
    "next: continue current run, consume pending tool result for the same toolCallId, and respond.",
  ].join("\n");
}

function readToolCommand(data: Record<string, unknown>): string {
  const args = isRecord(data.args) ? (data.args as Record<string, unknown>) : null;
  if (args && typeof args.command === "string" && args.command.trim()) return args.command.trim();
  if (typeof data.command === "string" && data.command.trim()) return data.command.trim();
  const input = isRecord(data.input) ? (data.input as Record<string, unknown>) : null;
  if (input && typeof input.command === "string" && input.command.trim())
    return input.command.trim();
  return "";
}

function makeSessionRunKey(sessionKey: string, runId: string): string {
  return `${normalizeSessionKey(sessionKey)}::${runId.trim()}`;
}

function coalesceHandoffPayload(
  previous: HandOffPayload | null,
  next: HandOffPayload,
): HandOffPayload {
  if (!previous) return next;
  if (previous.sessionKey !== next.sessionKey) return next;
  if (previous.source !== next.source) return next;
  if (previous.approvalId && next.approvalId && previous.approvalId !== next.approvalId) {
    return next;
  }
  if (previous.toolCallId && next.toolCallId && previous.toolCallId !== next.toolCallId) {
    return next;
  }

  return {
    ...previous,
    ...next,
    runId: next.runId ?? previous.runId,
    approvalId: next.approvalId ?? previous.approvalId,
    approvalAtMs: next.approvalAtMs ?? previous.approvalAtMs,
    approvalAtMsFromPayload: next.approvalAtMsFromPayload ?? previous.approvalAtMsFromPayload,
    command: next.command ?? previous.command,
    toolCallId: next.toolCallId ?? previous.toolCallId,
    text: next.text ?? previous.text,
    retryCount: next.retryCount ?? previous.retryCount,
  };
}

export function useExecSystemHandoff(params: { sessionKey: string; hasSession: boolean }) {
  const { sessionKey, hasSession } = params;
  const normalizedSessionKey = normalizeSessionKey(sessionKey);

  const latestRunIdRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingPayloadRef = useRef<HandOffPayload | null>(null);
  const cooldownByDigestRef = useRef<Map<string, number>>(new Map());
  const approvalLoopNudgedRef = useRef<Set<string>>(new Set());
  const approvalRetryExhaustedRef = useRef<Set<string>>(new Set());
  const approvalContextByIdRef = useRef<Map<string, ApprovalHandoffContext>>(new Map());
  const latestApprovalIdBySessionRef = useRef<Map<string, string>>(new Map());
  const toolCallIdBySessionRunRef = useRef<Map<string, string>>(new Map());
  const ALLOW_RESULT_RETRY_DELAYS_MS = [300, 1200, 3000, 8000];
  const MAX_COOLDOWN_DIGEST_ENTRIES = 1000;

  const getSessionApprovalContext = useCallback(
    (session: string): ApprovalHandoffContext | null => {
      const normalized = normalizeSessionKey(session);
      if (!normalized) return null;
      const approvalId = latestApprovalIdBySessionRef.current.get(normalized);
      if (!approvalId) return null;
      const context = approvalContextByIdRef.current.get(approvalId);
      if (!context || context.source !== "approval-allow") return null;
      return context;
    },
    [],
  );

  const upsertApprovalContext = useCallback(
    (next: ApprovalHandoffContext): ApprovalHandoffContext => {
      const existing = approvalContextByIdRef.current.get(next.approvalId);
      const merged: ApprovalHandoffContext = existing
        ? {
            ...existing,
            ...next,
            runId: next.runId ?? existing.runId,
            command: next.command ?? existing.command,
            toolCallId: next.toolCallId ?? existing.toolCallId,
            approvalAtMs: next.approvalAtMs ?? existing.approvalAtMs,
            approvalAtMsFromPayload:
              next.approvalAtMsFromPayload ?? existing.approvalAtMsFromPayload,
          }
        : next;
      approvalContextByIdRef.current.set(merged.approvalId, merged);
      latestApprovalIdBySessionRef.current.set(merged.sessionKey, merged.approvalId);
      return merged;
    },
    [],
  );

  const clearApprovalContext = useCallback((approvalId: string | undefined): void => {
    if (!approvalId) return;
    const existing = approvalContextByIdRef.current.get(approvalId);
    approvalContextByIdRef.current.delete(approvalId);
    if (!existing) return;
    if (latestApprovalIdBySessionRef.current.get(existing.sessionKey) === approvalId) {
      latestApprovalIdBySessionRef.current.delete(existing.sessionKey);
    }
  }, []);

  const pruneCooldownDigests = useCallback((now: number) => {
    const map = cooldownByDigestRef.current;
    for (const [digest, at] of map.entries()) {
      if (now - at >= HANDOFF_COOLDOWN_MS) map.delete(digest);
    }
    if (map.size <= MAX_COOLDOWN_DIGEST_ENTRIES) return;

    // Keep only the most recent digests to avoid unbounded growth.
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    map.clear();
    for (const [digest, at] of entries.slice(0, MAX_COOLDOWN_DIGEST_ENTRIES)) {
      map.set(digest, at);
    }
  }, []);

  const isCooldownActive = useCallback((digest: string) => {
    const at = cooldownByDigestRef.current.get(digest);
    return !!at && Date.now() - at < HANDOFF_COOLDOWN_MS;
  }, []);

  const sendAgentInput = useCallback(
    async (payload: HandOffPayload, rawText: string) => {
      const text = normalizeText(rawText);
      if (!text) return;

      const digestRunKey =
        payload.toolCallId ?? payload.runId ?? payload.command ?? payload.approvalId;
      const digest = hashText(payload.sessionKey, digestRunKey, `${payload.source}|${text}`);
      pruneCooldownDigests(Date.now());
      if (isCooldownActive(digest)) return;

      try {
        await ipc.chat.request("agent", {
          sessionKey: payload.sessionKey,
          message: text,
          idempotencyKey: `handoff:${digest}`,
          inputProvenance: {
            kind: INTERNAL_SYSTEM_KIND,
            sourceSessionKey: payload.sessionKey,
            sourceTool: payload.source,
          },
        });
        chatLog.info(
          "[exec.system.handoff]",
          `session=${payload.sessionKey}`,
          `runId=${payload.runId ?? "<none>"}`,
          `source=${payload.source}`,
          `message=${text.slice(0, 120)}`,
        );
        cooldownByDigestRef.current.set(digest, Date.now());
        pruneCooldownDigests(Date.now());
      } catch (error) {
        chatLog.warn(
          "[exec.system.handoff.failed]",
          `session=${payload.sessionKey}`,
          `runId=${payload.runId ?? "<none>"}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [isCooldownActive, pruneCooldownDigests],
  );

  const refreshAndSend = useCallback(
    async (payload: HandOffPayload) => {
      try {
        const response = (await ipc.chat.request("chat.history", {
          sessionKey: payload.sessionKey,
          limit: HISTORY_LIMIT,
        })) as { messages?: unknown };
        const approvalMinAtMs =
          payload.source === "approval-allow" && typeof payload.approvalAtMs === "number"
            ? Math.max(0, payload.approvalAtMs - (payload.approvalAtMsFromPayload ? 500 : 15_000))
            : undefined;
        const historyText = pickLastHistoryText({
          messages: response?.messages,
          sessionKey: payload.sessionKey,
          runId: payload.runId,
          requireRunIdMatch: Boolean(payload.toolCallId && payload.runId),
          toolCallId: payload.toolCallId,
          requireToolCallIdMatch: Boolean(payload.toolCallId),
        });
        const terminalHistoryText = pickLastHistoryText({
          messages: response?.messages,
          sessionKey: payload.sessionKey,
          runId: payload.runId,
          requireRunIdMatch: Boolean(payload.toolCallId && payload.runId),
          toolCallId: payload.toolCallId,
          requireToolCallIdMatch: Boolean(payload.toolCallId),
          minAtMs: approvalMinAtMs,
          predicate: (text) => {
            if (!isLikelyTerminalResultText(text)) return false;
            return true;
          },
        });
        const genericHistoryText =
          payload.source === "approval-allow"
            ? pickLastHistoryText({
                messages: response?.messages,
                sessionKey: payload.sessionKey,
                runId: payload.runId,
                requireRunIdMatch: Boolean(payload.toolCallId && payload.runId),
                toolCallId: payload.toolCallId,
                requireToolCallIdMatch: Boolean(payload.toolCallId),
                minAtMs: approvalMinAtMs,
                predicate: (text, raw) => {
                  if (!isSystemLikeResultRecord(raw)) return false;
                  const normalized = normalizeText(text).toLowerCase();
                  if (!normalized) return false;
                  if (normalized.includes("execution approved")) return false;
                  if (normalized.includes("approval required")) return false;
                  if (normalized.includes("approve to run")) return false;
                  return true;
                },
              })
            : null;
        const normalizedPayloadText = normalizeText(payload.text ?? "");
        const normalizedHistoryText = normalizeText(historyText ?? "");
        const historyTerminalText = normalizeText(terminalHistoryText ?? "");
        const historyGenericText = normalizeText(genericHistoryText ?? "");

        // For approval allow events, only handoff terminal output to avoid
        // echoing "Execution approved..." as the assistant continuation.
        if (payload.source === "approval-allow") {
          let heartbeatPreviewText = "";
          if (!historyTerminalText && !historyGenericText) {
            try {
              const heartbeat = await ipc.chat.request("last-heartbeat");
              heartbeatPreviewText = readHeartbeatExecPreview(heartbeat, approvalMinAtMs) ?? "";
              if (heartbeatPreviewText) {
                chatLog.debug(
                  "[exec.system.handoff.heartbeat-fallback]",
                  `session=${payload.sessionKey}`,
                  `runId=${payload.runId ?? "<none>"}`,
                  `preview=${heartbeatPreviewText.slice(0, 120)}`,
                );
              }
            } catch (error) {
              chatLog.debug(
                "[exec.system.handoff.heartbeat-fallback.failed]",
                `session=${payload.sessionKey}`,
                error instanceof Error ? error.message : String(error),
              );
            }
          }

          const selectedApprovalText =
            payload.toolCallId && normalizedPayloadText
              ? normalizedPayloadText
              : historyTerminalText || historyGenericText || heartbeatPreviewText;
          if (!selectedApprovalText) {
            const retryCount = payload.retryCount ?? 0;
            chatLog.debug(
              "[exec.system.handoff.approval.waiting-terminal]",
              `session=${payload.sessionKey}`,
              `runId=${payload.runId ?? "<none>"}`,
              `retry=${retryCount}`,
            );
            const nudgeKey = hashText(
              payload.sessionKey,
              payload.approvalId ?? payload.runId ?? payload.command ?? "approval-allow",
              "loop-nudge",
            );
            if (!approvalLoopNudgedRef.current.has(nudgeKey)) {
              approvalLoopNudgedRef.current.add(nudgeKey);
              void sendAgentInput(payload, buildApprovalLoopNudgeText(payload.command));
              chatLog.debug(
                "[exec.system.handoff.loop-nudge]",
                `session=${payload.sessionKey}`,
                `runId=${payload.runId ?? "<none>"}`,
                `approvalId=${payload.approvalId ?? "<none>"}`,
                `retry=${retryCount}`,
              );
            }
            const retryDelay = ALLOW_RESULT_RETRY_DELAYS_MS[retryCount];
            if (retryDelay) {
              const timer = setTimeout(() => {
                void refreshAndSend({
                  ...payload,
                  retryCount: retryCount + 1,
                });
              }, retryDelay);
              retryTimersRef.current.push(timer);
            } else {
              const exhaustedKey = hashText(
                payload.sessionKey,
                payload.approvalId ?? payload.toolCallId ?? payload.command ?? "approval-allow",
                "retry-exhausted",
              );
              if (!approvalRetryExhaustedRef.current.has(exhaustedKey)) {
                approvalRetryExhaustedRef.current.add(exhaustedKey);
                void sendAgentInput(payload, buildApprovalRetryExhaustedText(payload));
                chatLog.warn(
                  "[exec.system.handoff.approval.retry-exhausted]",
                  `session=${payload.sessionKey}`,
                  `runId=${payload.runId ?? "<none>"}`,
                  `approvalId=${payload.approvalId ?? "<none>"}`,
                  `toolCallId=${payload.toolCallId ?? "<none>"}`,
                );
              }
            }
            return;
          }
          if (payload.command) {
            markExecCommandTerminal(payload.sessionKey, payload.command);
            useExecApprovalsStore.getState().clearRunning(payload.sessionKey, payload.command);
          }
          await sendAgentInput(payload, selectedApprovalText);
          clearApprovalContext(payload.approvalId);
          return;
        }

        await sendAgentInput(
          payload,
          historyTerminalText || normalizedPayloadText || normalizedHistoryText || "",
        );
      } catch (error) {
        chatLog.warn(
          "[exec.system.handoff.history.failed]",
          `session=${payload.sessionKey}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [sendAgentInput],
  );

  const scheduleHandoff = useCallback(
    (payload: HandOffPayload) => {
      if (!hasSession || !normalizedSessionKey) return;
      const isApprovalPayload = payload.source.startsWith("approval-");
      if (!isApprovalPayload && payload.sessionKey !== normalizedSessionKey) return;
      chatLog.debug(
        "[exec.system.handoff.schedule]",
        `session=${payload.sessionKey}`,
        `runId=${payload.runId ?? "<none>"}`,
        `toolCallId=${payload.toolCallId ?? "<none>"}`,
        `source=${payload.source}`,
        `retry=${payload.retryCount ?? 0}`,
      );
      pendingPayloadRef.current = coalesceHandoffPayload(pendingPayloadRef.current, payload);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      for (const timer of retryTimersRef.current) clearTimeout(timer);
      retryTimersRef.current = [];

      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        const next = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        if (!next) return;
        chatLog.debug(
          "[exec.system.handoff.dispatch]",
          `session=${next.sessionKey}`,
          `runId=${next.runId ?? "<none>"}`,
          `toolCallId=${next.toolCallId ?? "<none>"}`,
          `source=${next.source}`,
          `retry=${next.retryCount ?? 0}`,
        );
        void refreshAndSend(next);
      }, HANDOFF_REFRESH_DELAY_MS);
    },
    [hasSession, normalizedSessionKey, refreshAndSend],
  );

  const handleApprovalResolved = useCallback(
    (payload: unknown) => {
      const parsed = parseApprovalEvent(payload);
      if (!parsed?.id) return;
      chatLog.debug(
        "[exec.system.handoff.approval.raw]",
        `id=${parsed.id}`,
        `decision=${parsed.decision ?? "<none>"}`,
        `session=${parsed.sessionKey ?? "<none>"}`,
        `command=${parsed.command ?? "<none>"}`,
      );

      const handoff = resolveApprovalHandoff({
        decision: parsed.decision,
        command: parsed.command,
      });
      const existing = approvalContextByIdRef.current.get(parsed.id);
      const mergedSession = parsed.sessionKey ?? existing?.sessionKey ?? normalizedSessionKey;
      const mergedCommand = parsed.command ?? existing?.command;
      const mergedRunId = existing?.runId;
      const mergedToolCallId = parsed.toolCallId ?? existing?.toolCallId;
      if (handoff.source === "approval-allow") {
        upsertApprovalContext({
          approvalId: parsed.id,
          source: handoff.source,
          sessionKey: mergedSession,
          runId: mergedRunId,
          command: mergedCommand,
          toolCallId: mergedToolCallId,
          approvalAtMs: parsed.atMs,
          approvalAtMsFromPayload: parsed.atMsFromPayload,
        });
      } else {
        clearApprovalContext(parsed.id);
      }
      scheduleHandoff({
        sessionKey: mergedSession,
        runId: mergedRunId,
        approvalId: parsed.id,
        approvalAtMs: parsed.atMs,
        approvalAtMsFromPayload: parsed.atMsFromPayload,
        command: mergedCommand,
        toolCallId: mergedToolCallId,
        source: handoff.source,
        text: handoff.text,
      });
    },
    [clearApprovalContext, normalizedSessionKey, scheduleHandoff, upsertApprovalContext],
  );

  const handleToolTerminal = useCallback(
    (payload: Record<string, unknown>) => {
      if (payload.stream !== "tool") return;
      const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
      if (!data) return;

      const text = readToolEventText(data);
      if (!text) return;
      const toolCallId = extractToolCallId(data);

      const runId =
        typeof payload.runId === "string" && payload.runId.trim()
          ? payload.runId.trim()
          : latestRunIdRef.current || undefined;
      const approvalContext = getSessionApprovalContext(normalizedSessionKey);
      if (approvalContext) {
        if (!toolCallId) {
          chatLog.debug(
            "[exec.system.handoff.tool.rejected]",
            `session=${normalizedSessionKey}`,
            `reason=missing_toolCallId`,
            `approvalId=${approvalContext.approvalId}`,
          );
          return;
        }
        if (approvalContext.runId && runId && approvalContext.runId !== runId) {
          chatLog.debug(
            "[exec.system.handoff.tool.rejected]",
            `session=${normalizedSessionKey}`,
            `reason=run_mismatch`,
            `approvalId=${approvalContext.approvalId}`,
            `expectedRun=${approvalContext.runId}`,
            `actualRun=${runId}`,
            `toolCallId=${toolCallId}`,
          );
          return;
        }
        if (approvalContext.toolCallId && approvalContext.toolCallId !== toolCallId) {
          chatLog.debug(
            "[exec.system.handoff.tool.rejected]",
            `session=${normalizedSessionKey}`,
            `reason=toolCallId_mismatch`,
            `approvalId=${approvalContext.approvalId}`,
            `expectedToolCallId=${approvalContext.toolCallId}`,
            `actualToolCallId=${toolCallId}`,
          );
          return;
        }
        const mergedContext = upsertApprovalContext({
          ...approvalContext,
          runId: runId ?? approvalContext.runId,
          toolCallId,
        });
        scheduleHandoff({
          sessionKey: mergedContext.sessionKey,
          runId: mergedContext.runId,
          approvalId: mergedContext.approvalId,
          approvalAtMs: mergedContext.approvalAtMs,
          approvalAtMsFromPayload: mergedContext.approvalAtMsFromPayload,
          command: mergedContext.command,
          toolCallId: mergedContext.toolCallId,
          source: "approval-allow",
          text,
        });
        return;
      }
      scheduleHandoff({
        sessionKey: normalizedSessionKey,
        runId,
        toolCallId: toolCallId || undefined,
        source: "agent-tool-terminal",
        text,
      });
    },
    [getSessionApprovalContext, normalizedSessionKey, scheduleHandoff, upsertApprovalContext],
  );

  const handleAssistantTerminal = useCallback(
    (payload: Record<string, unknown>) => {
      if (payload.stream !== "assistant") return;
      const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
      if (!data) return;
      const text = normalizeText(typeof data.text === "string" ? data.text : "");
      if (!text || !isLikelyTerminalResultText(text)) return;

      const runId =
        typeof payload.runId === "string" && payload.runId.trim()
          ? payload.runId.trim()
          : latestRunIdRef.current || undefined;
      markSessionRunningCommandsTerminal(normalizedSessionKey);
      useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
      scheduleHandoff({
        sessionKey: normalizedSessionKey,
        runId,
        source: "agent-tool-terminal",
        text,
      });
    },
    [normalizedSessionKey, scheduleHandoff],
  );

  const matchGatewayAgentPayloadSession = useCallback(
    (payload: Record<string, unknown>): boolean => {
      const payloadSession =
        typeof payload.sessionKey === "string" ? normalizeSessionKey(payload.sessionKey) : "";
      if (payloadSession) return payloadSession === normalizedSessionKey;

      const payloadRunId = typeof payload.runId === "string" ? payload.runId.trim() : "";
      if (payloadRunId && latestRunIdRef.current && payloadRunId === latestRunIdRef.current) {
        return true;
      }

      const stream = typeof payload.stream === "string" ? payload.stream : "";
      if (stream !== "tool" && stream !== "assistant") return false;
      if (!hasSessionApprovalOrRunningContext(normalizedSessionKey)) return false;

      const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
      if (!data) return false;

      if (stream === "tool") {
        const toolCallId = extractToolCallId(data);
        const approvalContext = getSessionApprovalContext(normalizedSessionKey);
        if (approvalContext) {
          if (!toolCallId) return false;
          if (approvalContext.toolCallId && approvalContext.toolCallId !== toolCallId) return false;
          if (approvalContext.runId && payloadRunId && approvalContext.runId !== payloadRunId) {
            return false;
          }
          return true;
        }
        const command = readToolCommand(data);
        if (!command) return false;

        const runningKey = `${normalizedSessionKey}::${command}`;
        const state = useExecApprovalsStore.getState();
        if (state.runningByKey[runningKey]) return true;

        return state.queue.some((entry) => {
          const entrySession = normalizeSessionKey(entry.request.sessionKey);
          const entryCommand = entry.request.command?.trim() ?? "";
          return entrySession === normalizedSessionKey && entryCommand === command;
        });
      }

      const assistantText = normalizeText(typeof data.text === "string" ? data.text : "");
      return Boolean(assistantText && isLikelyTerminalResultText(assistantText));
    },
    [getSessionApprovalContext, normalizedSessionKey],
  );

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      if (typeof event.clientRunId === "string" && event.clientRunId.trim()) {
        latestRunIdRef.current = event.clientRunId.trim();
      }
      if (event.kind === "run.approval_resolved") {
        chatLog.debug(
          "[exec.system.handoff.approval.normalized]",
          `session=${event.sessionKey}`,
          `runId=${event.clientRunId ?? "<none>"}`,
          `decision=${event.decision ?? "<none>"}`,
          `command=${event.command ?? "<none>"}`,
        );
        const handoff = resolveApprovalHandoff({
          decision: event.decision ?? null,
          command: event.command,
        });
        const approvalId = event.approvalId?.trim();
        const runId = event.clientRunId?.trim() || latestRunIdRef.current || undefined;
        const toolCallId =
          runId && normalizedSessionKey
            ? toolCallIdBySessionRunRef.current.get(makeSessionRunKey(normalizedSessionKey, runId))
            : undefined;
        if (handoff.source === "approval-allow" && approvalId) {
          upsertApprovalContext({
            approvalId,
            source: handoff.source,
            sessionKey: normalizedSessionKey,
            runId,
            command: event.command,
            toolCallId,
            approvalAtMs: event.timestampMs,
            approvalAtMsFromPayload: true,
          });
        } else if (approvalId) {
          clearApprovalContext(approvalId);
        }
        scheduleHandoff({
          sessionKey: normalizedSessionKey,
          runId,
          approvalId,
          approvalAtMs: event.timestampMs,
          approvalAtMsFromPayload: true,
          command: event.command,
          toolCallId,
          source: handoff.source,
          text: handoff.text,
        });
        return;
      }
      if (
        (event.kind === "run.tool_started" ||
          event.kind === "run.tool_updated" ||
          event.kind === "run.tool_finished") &&
        event.metadata &&
        typeof event.metadata === "object"
      ) {
        const metadata = event.metadata as Record<string, unknown>;
        const toolCallId = extractToolCallId(metadata);
        if (!toolCallId) return;
        const runId = event.clientRunId?.trim();
        if (runId) {
          toolCallIdBySessionRunRef.current.set(
            makeSessionRunKey(normalizedSessionKey, runId),
            toolCallId,
          );
        }
        const approvalContext = getSessionApprovalContext(normalizedSessionKey);
        if (!approvalContext) return;
        if (approvalContext.runId && runId && approvalContext.runId !== runId) return;
        if (approvalContext.toolCallId && approvalContext.toolCallId !== toolCallId) return;
        upsertApprovalContext({
          ...approvalContext,
          toolCallId,
          runId: runId ?? approvalContext.runId,
        });
      }
    });
  }, [
    clearApprovalContext,
    getSessionApprovalContext,
    hasSession,
    normalizedSessionKey,
    scheduleHandoff,
    upsertApprovalContext,
  ]);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame: GatewayEventFrame) => {
      if (frame.type !== "event") return;
      if (frame.event === "exec.approval.resolved") {
        handleApprovalResolved(frame.payload);
        return;
      }

      if (frame.event === "chat") {
        const parsed = parseChatTerminalEvent(frame.payload);
        if (!parsed || parsed.sessionKey !== normalizedSessionKey) return;
        markSessionRunningCommandsTerminal(parsed.sessionKey);
        useExecApprovalsStore.getState().clearRunningForSession(parsed.sessionKey);
        scheduleHandoff({
          sessionKey: parsed.sessionKey,
          runId: parsed.runId ?? latestRunIdRef.current ?? undefined,
          source: "agent-tool-terminal",
          text: parsed.text,
        });
        return;
      }

      if (frame.event !== "agent" || !isRecord(frame.payload)) return;
      const payload = frame.payload as Record<string, unknown>;
      if (!matchGatewayAgentPayloadSession(payload)) return;
      handleToolTerminal(payload);
      handleAssistantTerminal(payload);
    });
  }, [
    handleApprovalResolved,
    handleAssistantTerminal,
    handleToolTerminal,
    hasSession,
    matchGatewayAgentPayloadSession,
    normalizedSessionKey,
    scheduleHandoff,
  ]);

  useEffect(
    () => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      for (const timer of retryTimersRef.current) clearTimeout(timer);
      retryTimersRef.current = [];
      pendingPayloadRef.current = null;
      latestRunIdRef.current = null;
      cooldownByDigestRef.current.clear();
      approvalLoopNudgedRef.current.clear();
      approvalRetryExhaustedRef.current.clear();
      approvalContextByIdRef.current.clear();
      latestApprovalIdBySessionRef.current.clear();
      toolCallIdBySessionRunRef.current.clear();
    },
    [],
  );
}
