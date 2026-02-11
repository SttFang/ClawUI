import type { UIMessage } from "ai";
import { openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { useCallback, useEffect, useRef } from "react";
import { ipc, type ChatNormalizedRunEvent, type GatewayEventFrame } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { ensureChatConnected } from "./connection";
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

const DEFAULT_REFRESH_THROTTLE_MS = 800;
const HEARTBEAT_REFRESH_THROTTLE_MS = 2_500;
const RECOVERY_HEARTBEAT_REFRESH_THROTTLE_MS = 1_200;
const APPROVAL_RECOVERY_WINDOW_MS = 120_000;
const TERMINAL_RECOVERY_WINDOW_MS = 20_000;

function isExecToolFinished(event: ChatNormalizedRunEvent): boolean {
  if (event.kind !== "run.tool_finished") return false;
  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : null;
  const toolName = typeof metadata?.name === "string" ? metadata.name.trim() : "";
  return toolName === "" || toolName === "exec";
}

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

function shouldForceRefreshOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
    event.kind === "run.approval_resolved"
  );
}

function shouldClearRunningOnNormalizedEvent(event: ChatNormalizedRunEvent): boolean {
  return (
    event.kind === "run.completed" ||
    event.kind === "run.failed" ||
    event.kind === "run.aborted" ||
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
  const lastHistoryAtRef = useRef(0);
  const lastHistorySigRef = useRef("");
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approvalRecoveryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastHandledApprovalIdRef = useRef<string | null>(null);
  const recoveryUntilMsRef = useRef(0);

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
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({ force: false, reason: "inflight-retry", allowRetry: false });
          }, 250);
        }
        return false;
      }

      const now = Date.now();
      const heartbeatThrottleMs =
        reason === "heartbeat"
          ? isRecoveryActive()
            ? RECOVERY_HEARTBEAT_REFRESH_THROTTLE_MS
            : HEARTBEAT_REFRESH_THROTTLE_MS
          : null;
      const throttleMs = force
        ? 0
        : (options?.throttleMs ?? heartbeatThrottleMs ?? DEFAULT_REFRESH_THROTTLE_MS);
      if (!force && now - lastHistoryAtRef.current < throttleMs) {
        if (allowRetry && !pendingRefreshTimerRef.current) {
          pendingRefreshTimerRef.current = setTimeout(() => {
            pendingRefreshTimerRef.current = null;
            void refreshHistory({ force: false, reason: "throttle-retry", allowRetry: false });
          }, throttleMs + 50);
        }
        return false;
      }

      lastHistoryAtRef.current = now;
      historyInFlightRef.current = true;
      try {
        await ensureChatConnected();
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
        return changed;
      } catch (error) {
        chatLog.warn(
          "[chat.history.refresh.failed]",
          `session=${normalizedSessionKey}`,
          `reason=${reason}`,
          error instanceof Error ? error.message : String(error),
        );
        return false;
      } finally {
        historyInFlightRef.current = false;
      }
    },
    [hasSession, isRecoveryActive, normalizedSessionKey],
  );

  useEffect(() => {
    lastHistoryAtRef.current = 0;
    lastHistorySigRef.current = "";
    historyInFlightRef.current = false;
    lastHandledApprovalIdRef.current = null;
    recoveryUntilMsRef.current = 0;
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
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];

    void refreshHistory({
      force: true,
      reason: "approval-resolved-immediate",
      allowRetry: false,
    });
    for (const delayMs of APPROVAL_RECOVERY_FOLLOWUPS_MS) {
      const timer = setTimeout(() => {
        void refreshHistory({
          force: false,
          reason: `approval-resolved-followup-${delayMs}`,
          allowRetry: false,
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
          allowRetry: false,
        });
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
            allowRetry: false,
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
            force: false,
            reason: `lifecycle-${phase}`,
            allowRetry: false,
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
          allowRetry: false,
        });
      }
    });
  }, [extendRecoveryWindow, hasSession, normalizedSessionKey, refreshHistory]);

  return { refreshHistory };
}
