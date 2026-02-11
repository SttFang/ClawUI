import type { UIMessage } from "ai";
import { openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { useCallback, useEffect, useRef } from "react";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { buildHistoryFingerprint } from "./historyFingerprint";
import {
  APPROVAL_RECOVERY_FOLLOWUPS_MS,
  shouldRefreshHistoryOnHeartbeat,
} from "./historyRefreshPolicy";

type LastResolvedApproval = {
  id: string;
  decision: "allow-once" | "allow-always" | "deny";
  atMs: number;
};

function shouldRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    event.kind === "run.approval_resolved" ||
    event.kind === "run.waiting_approval" ||
    event.kind === "run.tool_finished"
  );
}

function shouldClearRunningOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" || event.kind === "run.failed" || event.kind === "run.aborted"
  );
}

export function useOpenClawHistorySync(params: {
  sessionKey: string;
  hasSession: boolean;
  setMessages: (messages: UIMessage[]) => void;
}) {
  const { sessionKey, hasSession, setMessages } = params;
  const normalizedSessionKey = sessionKey.trim();

  const lastResolvedApproval = useExecApprovalsStore(
    (s) => s.lastResolvedBySession[normalizedSessionKey],
  );

  const setMessagesRef = useRef(setMessages);
  const historyInFlightRef = useRef(false);
  const lastHistoryAtRef = useRef(0);
  const lastHistorySigRef = useRef("");
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approvalRecoveryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastHandledApprovalIdRef = useRef<string | null>(null);

  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);

  const refreshHistory = useCallback(
    async (options?: { force?: boolean; reason?: string }) => {
      const force = options?.force === true;
      const reason = options?.reason ?? "unknown";
      if (!hasSession || !normalizedSessionKey) return;

      if (historyInFlightRef.current) {
        if (!pendingRefreshTimerRef.current) {
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({ force: true, reason: "inflight-retry" });
          }, 250);
        }
        return;
      }

      const now = Date.now();
      if (!force && now - lastHistoryAtRef.current < 800) {
        if (!pendingRefreshTimerRef.current) {
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({ force: true, reason: "throttle-retry" });
          }, 850);
        }
        return;
      }

      lastHistoryAtRef.current = now;
      historyInFlightRef.current = true;
      try {
        const connected = await ipc.chat.isConnected();
        if (!connected) {
          const ok = await ipc.chat.connect();
          if (!ok) return;
        }
        const res = (await ipc.chat.request("chat.history", {
          sessionKey: normalizedSessionKey,
          limit: 200,
        })) as { messages?: unknown };
        const uiMessages = openclawTranscriptToUIMessages(res?.messages);

        const sig = buildHistoryFingerprint(uiMessages);
        const changed = sig !== lastHistorySigRef.current;
        if (changed) {
          lastHistorySigRef.current = sig;
          setMessagesRef.current(uiMessages);
        }

        chatLog.info(
          "[chat.history.refresh]",
          `session=${normalizedSessionKey}`,
          `reason=${reason}`,
          `force=${force}`,
          `changed=${changed}`,
          `count=${uiMessages.length}`,
        );
      } catch (error) {
        chatLog.warn(
          "[chat.history.refresh.failed]",
          `session=${normalizedSessionKey}`,
          `reason=${reason}`,
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        historyInFlightRef.current = false;
      }
    },
    [hasSession, normalizedSessionKey],
  );

  useEffect(() => {
    lastHistoryAtRef.current = 0;
    lastHistorySigRef.current = "";
    historyInFlightRef.current = false;
    lastHandledApprovalIdRef.current = null;
    if (pendingRefreshTimerRef.current) {
      clearTimeout(pendingRefreshTimerRef.current);
      pendingRefreshTimerRef.current = null;
    }
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];
  }, [normalizedSessionKey]);

  useEffect(
    () => () => {
      if (pendingRefreshTimerRef.current) {
        clearTimeout(pendingRefreshTimerRef.current);
        pendingRefreshTimerRef.current = null;
      }
      for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
      approvalRecoveryTimersRef.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    const resolved = lastResolvedApproval as LastResolvedApproval | undefined;
    if (!resolved?.id) return;
    if (lastHandledApprovalIdRef.current === resolved.id) return;

    lastHandledApprovalIdRef.current = resolved.id;
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];

    void refreshHistory({ force: true, reason: "approval-resolved-immediate" });
    for (const delayMs of APPROVAL_RECOVERY_FOLLOWUPS_MS) {
      const timer = setTimeout(() => {
        void refreshHistory({ force: true, reason: `approval-resolved-followup-${delayMs}` });
      }, delayMs);
      approvalRecoveryTimersRef.current.push(timer);
    }
  }, [hasSession, lastResolvedApproval, normalizedSessionKey, refreshHistory]);

  useEffect(() => {
    if (!hasSession) return;
    void refreshHistory({ force: true, reason: "session-init" });
  }, [hasSession, refreshHistory]);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame: GatewayEventFrame) => {
      if (frame.type !== "event") return;

      if (frame.event === "heartbeat") {
        const state = useExecApprovalsStore.getState();
        if (
          shouldRefreshHistoryOnHeartbeat({
            sessionKey: normalizedSessionKey,
            queue: state.queue,
            runningByKey: state.runningByKey,
          })
        ) {
          void refreshHistory({ force: true, reason: "heartbeat" });
        }
        return;
      }

      if (frame.event === "chat") {
        const payload = frame.payload as { sessionKey?: unknown; state?: unknown } | undefined;
        if (!payload || typeof payload !== "object") return;
        if (payload.sessionKey !== normalizedSessionKey) return;
        if (payload.state === "final" || payload.state === "aborted" || payload.state === "error") {
          useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
          void refreshHistory({ force: true, reason: `chat-${String(payload.state)}` });
        }
        return;
      }

      if (frame.event === "agent") {
        const payload = frame.payload as {
          sessionKey?: unknown;
          stream?: unknown;
          data?: unknown;
        } | null;
        if (!payload || typeof payload !== "object") return;
        if (payload.sessionKey !== normalizedSessionKey) return;
        if (payload.stream !== "lifecycle") return;
        const data =
          payload.data && typeof payload.data === "object"
            ? (payload.data as { phase?: unknown })
            : null;
        const phase = typeof data?.phase === "string" ? data.phase : "";
        if (phase === "end" || phase === "error") {
          useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
          void refreshHistory({ reason: `lifecycle-${phase}` });
        }
      }
    });
  }, [hasSession, normalizedSessionKey, refreshHistory]);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      if (shouldClearRunningOnNormalizedEvent(event)) {
        useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
      }
      if (shouldRefreshOnNormalizedEvent(event)) {
        void refreshHistory({ force: true, reason: event.kind });
      }
    });
  }, [hasSession, normalizedSessionKey, refreshHistory]);

  return { refreshHistory };
}
