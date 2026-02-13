import { useCallback, useEffect, useRef } from "react";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import type { HandOffPayload } from "./execSystemHandoff/types";
import {
  HANDOFF_COOLDOWN_MS,
  HANDOFF_REFRESH_DELAY_MS,
  HISTORY_LIMIT,
  INTERNAL_SYSTEM_KIND,
} from "./execSystemHandoff/constants";
import {
  parseApprovalEvent,
  readToolEventText,
  resolveApprovalHandoff,
} from "./execSystemHandoff/events";
import { pickLastHistoryText } from "./execSystemHandoff/history";
import { hashText, isRecord, normalizeSessionKey, normalizeText } from "./execSystemHandoff/utils";

export function useExecSystemHandoff(params: { sessionKey: string; hasSession: boolean }) {
  const { sessionKey, hasSession } = params;
  const normalizedSessionKey = normalizeSessionKey(sessionKey);

  const latestRunIdRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<HandOffPayload | null>(null);
  const cooldownByDigestRef = useRef<Map<string, number>>(new Map());

  const isCooldownActive = useCallback((digest: string) => {
    const at = cooldownByDigestRef.current.get(digest);
    return !!at && Date.now() - at < HANDOFF_COOLDOWN_MS;
  }, []);

  const sendAgentInput = useCallback(
    async (payload: HandOffPayload, rawText: string) => {
      const text = normalizeText(rawText);
      if (!text) return;

      const digest = hashText(payload.sessionKey, payload.runId, text);
      if (isCooldownActive(digest)) return;
      cooldownByDigestRef.current.set(digest, Date.now());

      try {
        await ipc.chat.request("agent", {
          sessionKey: payload.sessionKey,
          message: text,
          inputProvenance: {
            kind: INTERNAL_SYSTEM_KIND,
            sourceSessionKey: payload.sessionKey,
            runId: payload.runId,
            source: payload.source,
          },
        });
        chatLog.info(
          "[exec.system.handoff]",
          `session=${payload.sessionKey}`,
          `runId=${payload.runId ?? "<none>"}`,
          `source=${payload.source}`,
          `message=${text.slice(0, 120)}`,
        );
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
        const historyText = pickLastHistoryText({
          messages: response?.messages,
          sessionKey: payload.sessionKey,
          runId: payload.runId,
        });
        await sendAgentInput(payload, payload.text || historyText || "");
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
      if (!hasSession || !normalizedSessionKey || payload.sessionKey !== normalizedSessionKey)
        return;
      pendingPayloadRef.current = payload;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);

      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        const next = pendingPayloadRef.current;
        pendingPayloadRef.current = null;
        if (!next) return;
        void refreshAndSend(next);
      }, HANDOFF_REFRESH_DELAY_MS);
    },
    [hasSession, normalizedSessionKey, refreshAndSend],
  );

  const handleApprovalResolved = useCallback(
    (payload: unknown) => {
      const parsed = parseApprovalEvent(payload);
      if (!parsed?.id) return;
      if (parsed.sessionKey && parsed.sessionKey !== normalizedSessionKey) return;

      const handoff = resolveApprovalHandoff({
        decision: parsed.decision,
        command: parsed.command,
      });
      scheduleHandoff({
        sessionKey: parsed.sessionKey ?? normalizedSessionKey,
        runId: latestRunIdRef.current || undefined,
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

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      if (typeof event.clientRunId === "string" && event.clientRunId.trim()) {
        latestRunIdRef.current = event.clientRunId.trim();
      }
    });
  }, [hasSession, normalizedSessionKey]);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame: GatewayEventFrame) => {
      if (frame.type !== "event") return;
      if (frame.event === "exec.approval.resolved") {
        handleApprovalResolved(frame.payload);
        return;
      }
      if (frame.event !== "agent" || !isRecord(frame.payload)) return;
      const payload = frame.payload as Record<string, unknown>;
      const eventSession =
        typeof payload.sessionKey === "string" ? normalizeSessionKey(payload.sessionKey) : "";
      if (!eventSession || eventSession !== normalizedSessionKey) return;
      handleToolTerminal(payload);
    });
  }, [handleApprovalResolved, handleToolTerminal, hasSession, normalizedSessionKey]);

  useEffect(
    () => () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingPayloadRef.current = null;
      latestRunIdRef.current = null;
      cooldownByDigestRef.current.clear();
    },
    [],
  );
}
