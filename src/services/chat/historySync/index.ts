import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { clearTracesForSession } from "@/features/Chat/components/A2UI/execTrace";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { useExecApprovalsStore } from "@/store/exec";
import {
  APPROVAL_RECOVERY_FOLLOWUPS_MS,
  resetHeartbeatBackoff,
  shouldRefreshHistoryOnHeartbeat,
} from "../historyRefreshPolicy";
import {
  isExecToolFinished,
  shouldClearRunningOnNormalizedEvent,
  shouldForceRefreshOnNormalizedEvent,
  shouldRefreshOnNormalizedEvent,
} from "./guards";
import { useHistoryRefresh } from "./useHistoryRefresh";

type LastResolvedApproval = {
  id: string;
  decision: "allow-once" | "allow-always" | "deny";
  atMs: number;
};

const APPROVAL_RECOVERY_WINDOW_MS = 120_000;
const TERMINAL_RECOVERY_WINDOW_MS = 20_000;
const FORCE_FOLLOWUP_THRESHOLD_MS = 10_000;

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
  const approvalRecoveryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastHandledApprovalIdRef = useRef<string | null>(null);
  const recoveryUntilMsRef = useRef(0);
  const lastSessionKeyRef = useRef(normalizedSessionKey);

  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);

  const extendRecoveryWindow = useCallback((durationMs: number) => {
    if (durationMs <= 0) return;
    recoveryUntilMsRef.current = Math.max(recoveryUntilMsRef.current, Date.now() + durationMs);
  }, []);

  const isRecoveryActive = useCallback(() => {
    return recoveryUntilMsRef.current > Date.now();
  }, []);

  const { refreshHistory, resetRefreshState, clearPendingTimer } = useHistoryRefresh({
    normalizedSessionKey,
    hasSession,
    setMessagesRef,
    isRecoveryActive,
  });

  // Reset state on session change
  useEffect(() => {
    const previousSessionKey = lastSessionKeyRef.current;
    if (previousSessionKey && previousSessionKey !== normalizedSessionKey) {
      clearTracesForSession(previousSessionKey);
      resetHeartbeatBackoff(previousSessionKey);
    }
    lastSessionKeyRef.current = normalizedSessionKey;

    resetRefreshState();
    lastHandledApprovalIdRef.current = null;
    recoveryUntilMsRef.current = 0;
    resetHeartbeatBackoff(normalizedSessionKey);
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];
  }, [normalizedSessionKey, resetRefreshState]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearPendingTimer();
      for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
      approvalRecoveryTimersRef.current = [];
    },
    [clearPendingTimer],
  );

  // Approval-resolved recovery via Zustand store
  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    const resolved = lastResolvedApproval as LastResolvedApproval | undefined;
    if (!resolved?.id) return;
    if (lastHandledApprovalIdRef.current === resolved.id) return;

    lastHandledApprovalIdRef.current = resolved.id;
    extendRecoveryWindow(APPROVAL_RECOVERY_WINDOW_MS);
    resetHeartbeatBackoff(normalizedSessionKey);
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];

    void refreshHistory({
      force: true,
      reason: "approval-resolved-immediate",
      allowRetry: true,
    });
    for (const delayMs of APPROVAL_RECOVERY_FOLLOWUPS_MS) {
      const timer = setTimeout(() => {
        void refreshHistory({
          force: delayMs <= FORCE_FOLLOWUP_THRESHOLD_MS,
          reason: `approval-resolved-followup-${delayMs}`,
          allowRetry: true,
        });
      }, delayMs);
      approvalRecoveryTimersRef.current.push(timer);
    }
  }, [
    extendRecoveryWindow,
    hasSession,
    lastResolvedApproval,
    normalizedSessionKey,
    refreshHistory,
  ]);

  // Initial session load
  useEffect(() => {
    if (!hasSession) return;
    void refreshHistory({ force: true, reason: "session-init", allowRetry: false });
  }, [hasSession, refreshHistory]);

  // Gateway event listener
  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame: GatewayEventFrame) => {
      if (frame.type !== "event") return;

      if (frame.event === "heartbeat") {
        const heartbeatPayload =
          frame.payload && typeof frame.payload === "object"
            ? (frame.payload as { reason?: unknown })
            : null;
        const heartbeatReason =
          heartbeatPayload && typeof heartbeatPayload.reason === "string"
            ? heartbeatPayload.reason.trim().toLowerCase()
            : "";
        if (heartbeatReason === "exec-event") {
          extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
          void refreshHistory({
            force: true,
            reason: "heartbeat-exec-event",
            allowRetry: true,
          });
          return;
        }

        const state = useExecApprovalsStore.getState();
        if (
          shouldRefreshHistoryOnHeartbeat({
            sessionKey: normalizedSessionKey,
            queue: state.queue,
            runningByKey: state.runningByKey,
            recoveryActive: isRecoveryActive(),
          })
        ) {
          void refreshHistory({ force: false, reason: "heartbeat", allowRetry: false });
        }
        return;
      }

      if (frame.event === "exec.approval.requested") {
        const payload = frame.payload as
          | {
              request?: { sessionKey?: unknown };
            }
          | undefined;
        if (!payload || typeof payload !== "object") return;
        const request =
          payload.request && typeof payload.request === "object"
            ? (payload.request as { sessionKey?: unknown })
            : null;
        if (request?.sessionKey !== normalizedSessionKey) return;
        extendRecoveryWindow(APPROVAL_RECOVERY_WINDOW_MS);
        void refreshHistory({
          force: false,
          reason: "approval-requested",
          allowRetry: true,
        });
        return;
      }

      if (frame.event === "exec.approval.resolved") {
        const payload = frame.payload as
          | {
              sessionKey?: unknown;
            }
          | undefined;
        const payloadSession =
          payload && typeof payload === "object" && typeof payload.sessionKey === "string"
            ? payload.sessionKey
            : undefined;
        if (payloadSession && payloadSession !== normalizedSessionKey) return;

        extendRecoveryWindow(APPROVAL_RECOVERY_WINDOW_MS);
        for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
        approvalRecoveryTimersRef.current = [];
        void refreshHistory({
          force: true,
          reason: "approval-resolved-raw",
          allowRetry: true,
        });
        const fallbackTimer = setTimeout(() => {
          void refreshHistory({
            force: true,
            reason: "approval-resolved-raw-followup",
            allowRetry: false,
          });
        }, 250);
        approvalRecoveryTimersRef.current.push(fallbackTimer);
        return;
      }

      if (frame.event === "chat") {
        const payload = frame.payload as { sessionKey?: unknown; state?: unknown } | undefined;
        if (!payload || typeof payload !== "object") return;
        if (payload.sessionKey !== normalizedSessionKey) return;
        if (payload.state === "final" || payload.state === "aborted" || payload.state === "error") {
          useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
          extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
          void refreshHistory({
            force: true,
            reason: `chat-${String(payload.state)}`,
            allowRetry: true,
          });
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
          extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
          void refreshHistory({
            force: true,
            reason: `lifecycle-${phase}`,
            allowRetry: true,
          });
        }
      }
    });
  }, [extendRecoveryWindow, hasSession, isRecoveryActive, normalizedSessionKey, refreshHistory]);

  // Normalized event listener
  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      if (event.kind === "run.approval_resolved" || event.kind === "run.waiting_approval") {
        extendRecoveryWindow(APPROVAL_RECOVERY_WINDOW_MS);
      }
      if (
        event.kind === "run.completed" ||
        event.kind === "run.failed" ||
        event.kind === "run.aborted" ||
        isExecToolFinished(event)
      ) {
        extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
      }
      if (shouldClearRunningOnNormalizedEvent(event)) {
        useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
      }
      if (shouldRefreshOnNormalizedEvent(event)) {
        void refreshHistory({
          force: shouldForceRefreshOnNormalizedEvent(event),
          reason: event.kind,
          allowRetry: true,
        });
      }
    });
  }, [extendRecoveryWindow, hasSession, normalizedSessionKey, refreshHistory]);

  return { refreshHistory };
}
