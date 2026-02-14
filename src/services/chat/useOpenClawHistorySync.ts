import type { UIMessage } from "ai";
import { openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { useCallback, useEffect, useRef } from "react";
import { clearTracesForSession } from "@/components/A2UI/execTrace";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { ensureChatConnected } from "./connection";
import { buildHistoryFingerprint } from "./historyFingerprint";
import {
  APPROVAL_RECOVERY_FOLLOWUPS_MS,
  getEffectiveHeartbeatThrottleMs,
  recordHistoryRefreshResult,
  resetHeartbeatBackoff,
  shouldRefreshHistoryOnHeartbeat,
} from "./historyRefreshPolicy";

type LastResolvedApproval = {
  id: string;
  decision: "allow-once" | "allow-always" | "deny";
  atMs: number;
};

const DEFAULT_REFRESH_THROTTLE_MS = 800;
const CHAT_HISTORY_LIMIT = 1_000;
const APPROVAL_RECOVERY_WINDOW_MS = 120_000;
const TERMINAL_RECOVERY_WINDOW_MS = 20_000;
const FORCE_FOLLOWUP_THRESHOLD_MS = 10_000;
const MIN_PREV_MESSAGES_FOR_DROP_GUARD = 6;
const DROP_GUARD_MIN_DELTA = 4;
const DROP_GUARD_RATIO_THRESHOLD = 0.6;
const DROP_GUARD_RETRY_DELAY_MS = 350;

function isExecToolFinished(event: ChatNormalizedRunEvent): boolean {
  if (event.kind !== "run.tool_finished") return false;
  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : null;
  const toolName = typeof metadata?.name === "string" ? metadata.name.trim().toLowerCase() : "";
  return toolName === "" || toolName === "exec" || toolName === "bash";
}

function getLifecyclePhase(event: ChatNormalizedRunEvent): string {
  if (event.kind !== "run.lifecycle") return "";
  if (!event.metadata || typeof event.metadata !== "object") return "";
  const phase = (event.metadata as Record<string, unknown>).phase;
  return typeof phase === "string" ? phase : "";
}

function isTerminalLifecycleEvent(event: ChatNormalizedRunEvent): boolean {
  const phase = getLifecyclePhase(event);
  return phase === "end" || phase === "error";
}

function hasRecentTailOverlap(previous: UIMessage[], next: UIMessage[]): boolean {
  const tailIds = previous
    .slice(-3)
    .map((message) => message.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  if (tailIds.length === 0) return true;
  const nextIds = new Set(next.map((message) => message.id));
  return tailIds.some((id) => nextIds.has(id));
}

function isLikelyTransientHistoryDrop(previous: UIMessage[], next: UIMessage[]): boolean {
  if (previous.length < MIN_PREV_MESSAGES_FOR_DROP_GUARD) return false;
  if (next.length >= previous.length) return false;
  if (next.length === 0) return true;

  const delta = previous.length - next.length;
  if (delta < DROP_GUARD_MIN_DELTA) return false;
  if (next.length / previous.length > DROP_GUARD_RATIO_THRESHOLD) return false;

  return !hasRecentTailOverlap(previous, next);
}

function shouldRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    event.kind === "run.approval_resolved" ||
    event.kind === "run.waiting_approval" ||
    event.kind === "run.tool_finished"
  );
}

function shouldForceRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    event.kind === "run.approval_resolved"
  );
}

function shouldClearRunningOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    isTerminalLifecycleEvent(event) ||
    isExecToolFinished(event)
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
  const lastHistorySuccessAtRef = useRef(0);
  const lastHistorySigRef = useRef("");
  const lastAppliedMessagesRef = useRef<UIMessage[]>([]);
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const refreshHistory = useCallback(
    async (options?: {
      force?: boolean;
      reason?: string;
      allowRetry?: boolean;
      throttleMs?: number;
    }) => {
      const force = options?.force === true;
      const reason = options?.reason ?? "unknown";
      const allowRetry = options?.allowRetry !== false;
      if (!hasSession || !normalizedSessionKey) return false;

      if (historyInFlightRef.current) {
        if (allowRetry && !pendingRefreshTimerRef.current) {
          const retryReason = `${reason}-inflight-retry`;
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({
              force,
              reason: retryReason,
              allowRetry: false,
              throttleMs: options?.throttleMs,
            });
          }, 250);
        }
        return false;
      }

      const now = Date.now();
      const heartbeatThrottleMs =
        reason === "heartbeat"
          ? getEffectiveHeartbeatThrottleMs({
              sessionKey: normalizedSessionKey,
              recoveryActive: isRecoveryActive(),
            })
          : null;
      const throttleMs = force
        ? 0
        : (options?.throttleMs ?? heartbeatThrottleMs ?? DEFAULT_REFRESH_THROTTLE_MS);
      if (!force && now - lastHistorySuccessAtRef.current < throttleMs) {
        if (allowRetry && !pendingRefreshTimerRef.current) {
          const retryReason = `${reason}-throttle-retry`;
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({
              force,
              reason: retryReason,
              allowRetry: false,
              throttleMs: options?.throttleMs,
            });
          }, throttleMs + 50);
        }
        return false;
      }

      historyInFlightRef.current = true;
      try {
        await ensureChatConnected();
        const res = (await ipc.chat.request("chat.history", {
          sessionKey: normalizedSessionKey,
          limit: CHAT_HISTORY_LIMIT,
        })) as { messages?: unknown };
        const uiMessages = openclawTranscriptToUIMessages(res?.messages);

        const sig = buildHistoryFingerprint(uiMessages);
        let changed = sig !== lastHistorySigRef.current;
        if (changed) {
          const previousMessages = lastAppliedMessagesRef.current;
          const shouldGuardDrop =
            !force &&
            reason !== "session-init" &&
            isLikelyTransientHistoryDrop(previousMessages, uiMessages);
          if (shouldGuardDrop) {
            changed = false;
            chatLog.warn(
              "[chat.history.suspect_drop]",
              `session=${normalizedSessionKey}`,
              `reason=${reason}`,
              `prev=${previousMessages.length}`,
              `next=${uiMessages.length}`,
            );
            if (allowRetry && !pendingRefreshTimerRef.current) {
              pendingRefreshTimerRef.current = setTimeout(() => {
                pendingRefreshTimerRef.current = null;
                void refreshHistory({
                  force: true,
                  reason: `${reason}-suspect-drop-retry`,
                  allowRetry: false,
                });
              }, DROP_GUARD_RETRY_DELAY_MS);
            }
          }
        }

        if (changed) {
          lastHistorySigRef.current = sig;
          lastAppliedMessagesRef.current = uiMessages;
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
        lastHistorySuccessAtRef.current = Date.now();
        recordHistoryRefreshResult(normalizedSessionKey, changed);
        return changed;
      } catch (error) {
        chatLog.warn(
          "[chat.history.refresh.failed]",
          `session=${normalizedSessionKey}`,
          `reason=${reason}`,
          error instanceof Error ? error.message : String(error),
        );
        recordHistoryRefreshResult(normalizedSessionKey, false);
        return false;
      } finally {
        historyInFlightRef.current = false;
      }
    },
    [hasSession, isRecoveryActive, normalizedSessionKey],
  );

  useEffect(() => {
    const previousSessionKey = lastSessionKeyRef.current;
    if (previousSessionKey && previousSessionKey !== normalizedSessionKey) {
      clearTracesForSession(previousSessionKey);
      resetHeartbeatBackoff(previousSessionKey);
    }
    lastSessionKeyRef.current = normalizedSessionKey;

    lastHistorySuccessAtRef.current = 0;
    lastHistorySigRef.current = "";
    lastAppliedMessagesRef.current = [];
    historyInFlightRef.current = false;
    lastHandledApprovalIdRef.current = null;
    recoveryUntilMsRef.current = 0;
    resetHeartbeatBackoff(normalizedSessionKey);
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

  useEffect(() => {
    if (!hasSession) return;
    void refreshHistory({ force: true, reason: "session-init", allowRetry: false });
  }, [hasSession, refreshHistory]);

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
