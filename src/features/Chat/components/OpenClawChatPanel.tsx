import { useChat } from "@ai-sdk/react";
import { createOpenClawChatTransport, openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { Button } from "@clawui/ui";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom } from "use-stick-to-bottom";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { ChatComposer } from "../prompt/ChatComposer";
import { createRendererOpenClawAdapter } from "../utils/openclawAdapter";
import { AssistantMessageItem } from "./AssistantMessageItem";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { UserMessageItem } from "./UserMessageItem";

export function OpenClawChatPanel(props: {
  sessionKey: string | null;
  wsConnected: boolean;
  isGatewayRunning: boolean;
  onStartConversation: (content: string) => Promise<void>;
}) {
  const { sessionKey, wsConnected, isGatewayRunning, onStartConversation } = props;
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation("common");
  const normalizedSessionKey = sessionKey ?? "";
  const hasSession = normalizedSessionKey.trim().length > 0;
  const effectiveSessionKey = hasSession ? normalizedSessionKey : "__draft__";

  const adapter = useMemo(() => createRendererOpenClawAdapter(), []);
  const transport = useMemo(
    () => createOpenClawChatTransport({ sessionKey: effectiveSessionKey, adapter }),
    [effectiveSessionKey, adapter],
  );

  const chat = useChat({ id: effectiveSessionKey, transport });
  const [input, setInput] = useState("");
  const historyInFlightRef = useRef(false);
  const lastHistoryAtRef = useRef(0);
  const lastHistorySigRef = useRef<string>("");
  const pendingRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approvalRecoveryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastHandledApprovalIdRef = useRef<string | null>(null);
  const setMessagesRef = useRef(chat.setMessages);
  const lastResolvedApproval = useExecApprovalsStore(
    (s) => s.lastResolvedBySession[normalizedSessionKey],
  );

  useEffect(() => {
    // `useChat().setMessages` 在某些版本/实现里可能不是稳定引用，
    // 这里用 ref 避免 `refreshHistory` 因依赖变化导致的 effect 重跑刷屏。
    setMessagesRef.current = chat.setMessages;
  }, [chat.setMessages]);

  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const activeAssistantMessageId = useMemo(() => {
    if (chat.status !== "streaming") return null;
    for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
      const message = chat.messages[i];
      if (message?.role === "assistant") return message.id;
    }
    return null;
  }, [chat.messages, chat.status]);

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
      // 防止 chat.final/lifecycle 等短时间重复事件导致 Gateway 压力，但终态刷新可强制穿透。
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

        // Avoid re-render loops: only update local state if the tail signature changed.
        const last = uiMessages[uiMessages.length - 1];
        const tailText = last?.parts?.find((p) => p.type === "text")?.text ?? "";
        const sig = `${uiMessages.length}:${last?.id ?? ""}:${tailText.length}`;
        const changed = sig !== lastHistorySigRef.current;
        if (changed) {
          lastHistorySigRef.current = sig;
          setMessagesRef.current(uiMessages);
        }
        chatLog.debug(
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

  useEffect(() => {
    return () => {
      if (pendingRefreshTimerRef.current) {
        clearTimeout(pendingRefreshTimerRef.current);
        pendingRefreshTimerRef.current = null;
      }
      for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
      approvalRecoveryTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    const resolved = lastResolvedApproval;
    if (!resolved?.id) return;
    if (lastHandledApprovalIdRef.current === resolved.id) return;

    lastHandledApprovalIdRef.current = resolved.id;
    for (const timer of approvalRecoveryTimersRef.current) clearTimeout(timer);
    approvalRecoveryTimersRef.current = [];

    void refreshHistory({ force: true, reason: "approval-resolved-immediate" });
    const followUps = [500, 1500, 3000, 6000];
    for (const delayMs of followUps) {
      const timer = setTimeout(() => {
        void refreshHistory({ force: true, reason: `approval-resolved-followup-${delayMs}` });
      }, delayMs);
      approvalRecoveryTimersRef.current.push(timer);
    }
  }, [hasSession, lastResolvedApproval, normalizedSessionKey, refreshHistory]);

  // OpenClaw Control UI: chat.final 到达后用 history 作为权威状态刷新（避免 delta/agent 流丢字段）。
  useEffect(() => {
    if (!hasSession) return;
    void refreshHistory({ force: true, reason: "session-init" });
  }, [hasSession, refreshHistory]);

  useEffect(() => {
    if (!hasSession || !normalizedSessionKey) return;
    return ipc.gateway.onEvent((frame) => {
      if (frame.type !== "event") return;
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
    return ipc.chat.onNormalizedEvent((event) => {
      if (event.sessionKey !== normalizedSessionKey) return;
      if (
        event.kind === "run.completed" ||
        event.kind === "run.failed" ||
        event.kind === "run.aborted"
      ) {
        useExecApprovalsStore.getState().clearRunningForSession(normalizedSessionKey);
        void refreshHistory({ force: true, reason: event.kind });
      }
    });
  }, [hasSession, normalizedSessionKey, refreshHistory]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Messages */}
      <StickToBottom
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-0",
          // 允许触控/触控板在该区域垂直滚动
          "touch-pan-y",
        )}
        resize="smooth"
        initial="smooth"
      >
        <StickToBottom.Content className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {chat.messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("emptyTitle")}</p>
              <p className="text-sm mt-2">
                {isGatewayRunning
                  ? wsConnected
                    ? t("emptyHintConnected")
                    : t("emptyHintWsDisconnected")
                  : t("emptyHintGatewayStopped")}
              </p>
            </div>
          ) : (
            chat.messages.map((message, index) => {
              const key = `${message.id}:${index}`;
              if (message.role === "user") {
                return (
                  <UserMessageItem key={key} message={message} sessionKey={effectiveSessionKey} />
                );
              }

              return (
                <AssistantMessageItem
                  key={key}
                  message={message}
                  sessionKey={effectiveSessionKey}
                  streaming={activeAssistantMessageId === message.id}
                />
              );
            })
          )}

          {chat.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <div className="font-medium">{t("errorTitle")}</div>
              <div className="mt-1">{chat.error.message}</div>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => chat.clearError()}>
                  {tCommon("actions.close")}
                </Button>
              </div>
            </div>
          ) : null}
        </StickToBottom.Content>

        <ScrollToBottomButton />
      </StickToBottom>

      {/* Input area */}
      <div className="px-4 pt-0 pb-4">
        <ChatComposer
          sessionKey={hasSession ? normalizedSessionKey : ""}
          value={input}
          onChange={setInput}
          disabled={isBusy || !isGatewayRunning || !wsConnected}
          showSessionControls={hasSession}
          sessionControlsDisabled={!hasSession || !isGatewayRunning || !wsConnected}
          onSubmit={async () => {
            const text = input.trim();
            if (!text || isBusy) return;
            setInput("");
            if (!hasSession) {
              await onStartConversation(text);
              return;
            }
            await chat.sendMessage({ text });
          }}
        />
      </div>
    </div>
  );
}
