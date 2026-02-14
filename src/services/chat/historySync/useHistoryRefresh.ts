import type { UIMessage } from "ai";
import { openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { useCallback, useRef } from "react";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { ensureChatConnected } from "../connection";
import { buildHistoryFingerprint } from "../historyFingerprint";
import {
  getEffectiveHeartbeatThrottleMs,
  recordHistoryRefreshResult,
} from "../historyRefreshPolicy";
import { isLikelyTransientHistoryDrop } from "./guards";

const DEFAULT_REFRESH_THROTTLE_MS = 800;
const CHAT_HISTORY_LIMIT = 1_000;
const DROP_GUARD_RETRY_DELAY_MS = 350;

export type RefreshHistoryOptions = {
  force?: boolean;
  reason?: string;
  allowRetry?: boolean;
  throttleMs?: number;
};

export function useHistoryRefresh(params: {
  normalizedSessionKey: string;
  hasSession: boolean;
  setMessagesRef: React.RefObject<(messages: UIMessage[]) => void>;
  isRecoveryActive: () => boolean;
}) {
  const { normalizedSessionKey, hasSession, setMessagesRef, isRecoveryActive } = params;

  const historyInFlightRef = useRef(false);
  const lastHistorySuccessAtRef = useRef(0);
  const lastHistorySigRef = useRef("");
  const lastAppliedMessagesRef = useRef<UIMessage[]>([]);
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshHistory = useCallback(
    async (options?: RefreshHistoryOptions) => {
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
    [hasSession, isRecoveryActive, normalizedSessionKey, setMessagesRef],
  );

  const resetRefreshState = useCallback(() => {
    lastHistorySuccessAtRef.current = 0;
    lastHistorySigRef.current = "";
    lastAppliedMessagesRef.current = [];
    historyInFlightRef.current = false;
    if (pendingRefreshTimerRef.current) {
      clearTimeout(pendingRefreshTimerRef.current);
      pendingRefreshTimerRef.current = null;
    }
  }, []);

  const clearPendingTimer = useCallback(() => {
    if (pendingRefreshTimerRef.current) {
      clearTimeout(pendingRefreshTimerRef.current);
      pendingRefreshTimerRef.current = null;
    }
  }, []);

  return { refreshHistory, resetRefreshState, clearPendingTimer };
}
