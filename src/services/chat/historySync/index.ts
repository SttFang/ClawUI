import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { clearTracesForSession } from "@/features/Chat/components/A2UI/execTrace";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { useExecApprovalsStore } from "@/store/exec";
import { resetHeartbeatBackoff, shouldRefreshHistoryOnHeartbeat } from "../historyRefreshPolicy";
import {
  isExecToolFinished,
  shouldClearRunningOnNormalizedEvent,
  shouldForceRefreshOnNormalizedEvent,
  shouldRefreshOnNormalizedEvent,
} from "./guards";
import {
  createHistoryRefreshScheduler,
  mapApprovalRequestedToSignal,
  mapApprovalResolvedRawToSignal,
  mapChatStateToSignal,
  mapHeartbeatToSignal,
  mapLifecyclePhaseToSignal,
  type HistoryRefreshScheduler,
} from "./scheduler";
import { useHistoryRefresh } from "./useHistoryRefresh";

type LastResolvedApproval = {
  id: string;
  decision: "allow-once" | "allow-always" | "deny";
  atMs: number;
};

const APPROVAL_RECOVERY_WINDOW_MS = 120_000;
const TERMINAL_RECOVERY_WINDOW_MS = 20_000;

export function useOpenClawHistorySync(params: {
  sessionKey: string;
  hasSession: boolean;
  setMessages: (messages: UIMessage[]) => void;
  isStreaming?: boolean;
}) {
  const { sessionKey, hasSession, setMessages, isStreaming = false } = params;
  const normalizedSessionKey = sessionKey.trim();

  const lastResolvedApproval = useExecApprovalsStore(
    (s) => s.lastResolvedBySession[normalizedSessionKey],
  );

  const setMessagesRef = useRef(setMessages);
  const lastHandledApprovalIdRef = useRef<string | null>(null);
  const recoveryUntilMsRef = useRef(0);
  const lastSessionKeyRef = useRef(normalizedSessionKey);
  const isStreamingRef = useRef(isStreaming);
  const prevIsStreamingRef = useRef(isStreaming);
  const schedulerRef = useRef<HistoryRefreshScheduler | null>(null);

  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

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
    isStreamingRef,
  });

  // Build scheduler (once per session key)
  useEffect(() => {
    const scheduler = createHistoryRefreshScheduler({
      executeRefresh: (opts) => refreshHistory(opts),
      extendRecoveryWindow,
      clearRunningForSession: () =>
        useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey),
      resetHeartbeatBackoff: () => resetHeartbeatBackoff(normalizedSessionKey),
      shouldRefreshOnHeartbeat: () => {
        const state = useExecApprovalsStore.getState();
        return shouldRefreshHistoryOnHeartbeat({
          sessionKey: normalizedSessionKey,
          queue: state.queue,
          runningByKey: state.runningByKey,
          recoveryActive: isRecoveryActive(),
        });
      },
      isRecoveryActive,
    });
    schedulerRef.current = scheduler;
    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
    };
  }, [normalizedSessionKey, refreshHistory, extendRecoveryWindow, isRecoveryActive]);

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
  }, [normalizedSessionKey, resetRefreshState]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      clearPendingTimer();
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
    schedulerRef.current?.emitApprovalRecovery();
  }, [hasSession, lastResolvedApproval, normalizedSessionKey]);

  // Catchup refresh when streaming ends
  useEffect(() => {
    if (prevIsStreamingRef.current && !isStreaming) {
      schedulerRef.current?.emit({
        priority: "critical",
        force: true,
        reason: "stream-ended",
        allowRetry: true,
      });
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Initial session load
  useEffect(() => {
    if (!hasSession) return;
    schedulerRef.current?.emit({
      priority: "critical",
      force: true,
      reason: "session-init",
      allowRetry: false,
    });
  }, [hasSession]);

  // Gateway event listener
  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame: GatewayEventFrame) => {
      if (frame.type !== "event") return;
      const scheduler = schedulerRef.current;
      if (!scheduler) return;

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
        }
        const signal = mapHeartbeatToSignal(
          heartbeatReason,
          (() => {
            const state = useExecApprovalsStore.getState();
            return shouldRefreshHistoryOnHeartbeat({
              sessionKey: normalizedSessionKey,
              queue: state.queue,
              runningByKey: state.runningByKey,
              recoveryActive: isRecoveryActive(),
            });
          })(),
        );
        if (signal) scheduler.emit(signal);
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
        scheduler.emit(mapApprovalRequestedToSignal());
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
        scheduler.emit(mapApprovalResolvedRawToSignal());
        // Raw resolved also triggers a short followup
        const fallbackTimer = setTimeout(() => {
          scheduler.emit({
            priority: "critical",
            force: true,
            reason: "approval-resolved-raw-followup",
            allowRetry: false,
          });
        }, 250);
        // Timer will be cleaned up on scheduler dispose via session change
        void fallbackTimer;
        return;
      }

      if (frame.event === "chat") {
        const payload = frame.payload as { sessionKey?: unknown; state?: unknown } | undefined;
        if (!payload || typeof payload !== "object") return;
        if (payload.sessionKey !== normalizedSessionKey) return;
        const signal = mapChatStateToSignal(String(payload.state ?? ""));
        if (signal) {
          useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
          extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
          scheduler.emit(signal);
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
        const signal = mapLifecyclePhaseToSignal(phase);
        if (signal) {
          useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
          extendRecoveryWindow(TERMINAL_RECOVERY_WINDOW_MS);
          scheduler.emit(signal);
        }
      }
    });
  }, [extendRecoveryWindow, hasSession, isRecoveryActive, normalizedSessionKey]);

  // Normalized event listener
  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      const scheduler = schedulerRef.current;
      if (!scheduler) return;

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
        scheduler.emit({
          priority: shouldForceRefreshOnNormalizedEvent(event) ? "critical" : "normal",
          force: shouldForceRefreshOnNormalizedEvent(event),
          reason: event.kind,
          allowRetry: true,
        });
      }
    });
  }, [extendRecoveryWindow, hasSession, normalizedSessionKey]);

  return { refreshHistory };
}
