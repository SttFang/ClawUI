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
  isLikelyTerminalResultText,
  parseApprovalEvent,
  parseChatTerminalEvent,
  readHeartbeatExecPreview,
  readToolEventText,
  resolveApprovalHandoff,
} from "./execSystemHandoff/events";
import { pickLastHistoryText } from "./execSystemHandoff/history";
import { hashText, isRecord, normalizeSessionKey, normalizeText } from "./execSystemHandoff/utils";

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

  return {
    ...previous,
    ...next,
    runId: next.runId ?? previous.runId,
    approvalId: next.approvalId ?? previous.approvalId,
    approvalAtMs: next.approvalAtMs ?? previous.approvalAtMs,
    approvalAtMsFromPayload: next.approvalAtMsFromPayload ?? previous.approvalAtMsFromPayload,
    command: next.command ?? previous.command,
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
  const ALLOW_RESULT_RETRY_DELAYS_MS = [300, 1200, 3000, 8000];

  const isCooldownActive = useCallback((digest: string) => {
    const at = cooldownByDigestRef.current.get(digest);
    return !!at && Date.now() - at < HANDOFF_COOLDOWN_MS;
  }, []);

  const sendAgentInput = useCallback(
    async (payload: HandOffPayload, rawText: string) => {
      const text = normalizeText(rawText);
      if (!text) return;

      const digestRunKey = payload.runId ?? payload.command ?? payload.approvalId;
      const digest = hashText(payload.sessionKey, digestRunKey, `${payload.source}|${text}`);
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
      } catch (error) {
        chatLog.warn(
          "[exec.system.handoff.failed]",
          `session=${payload.sessionKey}`,
          `runId=${payload.runId ?? "<none>"}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [isCooldownActive],
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
        });
        const terminalHistoryText = pickLastHistoryText({
          messages: response?.messages,
          sessionKey: payload.sessionKey,
          runId: payload.runId,
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
            historyTerminalText || historyGenericText || heartbeatPreviewText;
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
            }
            return;
          }
          if (payload.command) {
            markExecCommandTerminal(payload.sessionKey, payload.command);
            useExecApprovalsStore.getState().clearRunning(payload.sessionKey, payload.command);
          }
          await sendAgentInput(payload, selectedApprovalText);
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
      scheduleHandoff({
        sessionKey: parsed.sessionKey ?? normalizedSessionKey,
        runId: undefined,
        approvalId: parsed.id,
        approvalAtMs: parsed.atMs,
        approvalAtMsFromPayload: parsed.atMsFromPayload,
        command: parsed.command,
        source: handoff.source,
        text: handoff.text,
      });
    },
    [normalizedSessionKey, scheduleHandoff],
  );

  const handleToolTerminal = useCallback(
    (payload: Record<string, unknown>) => {
      if (payload.stream !== "tool") return;
      const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
      if (!data) return;

      const text = readToolEventText(data);
      if (!text) return;

      const runId =
        typeof payload.runId === "string" && payload.runId.trim()
          ? payload.runId.trim()
          : latestRunIdRef.current || undefined;
      scheduleHandoff({
        sessionKey: normalizedSessionKey,
        runId,
        source: "agent-tool-terminal",
        text,
      });
    },
    [normalizedSessionKey, scheduleHandoff],
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
        const args = isRecord(data.args) ? (data.args as Record<string, unknown>) : null;
        const command = typeof args?.command === "string" ? args.command.trim() : "";
        if (!command) return true;

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
    [normalizedSessionKey],
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
        scheduleHandoff({
          sessionKey: normalizedSessionKey,
          runId: event.clientRunId?.trim() || latestRunIdRef.current || undefined,
          approvalId: event.approvalId ?? undefined,
          approvalAtMs: event.timestampMs,
          approvalAtMsFromPayload: true,
          command: event.command,
          source: handoff.source,
          text: handoff.text,
        });
      }
    });
  }, [hasSession, normalizedSessionKey, scheduleHandoff]);

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
    },
    [],
  );
}
