import { useChat } from "@ai-sdk/react";
import { createOpenClawChatTransport, openclawTranscriptToUIMessages } from "@clawui/claw-sse";
import { Button } from "@clawui/ui";
import { Send, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom } from "use-stick-to-bottom";
import { ipc } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { createRendererOpenClawAdapter } from "../utils/openclawAdapter";
import { MessageParts } from "./MessageParts";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { SessionControlStrip } from "./SessionControlStrip";

export function OpenClawChatPanel(props: {
  sessionKey: string;
  wsConnected: boolean;
  isGatewayRunning: boolean;
}) {
  const { sessionKey, wsConnected, isGatewayRunning } = props;
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation("common");

  const adapter = useMemo(() => createRendererOpenClawAdapter(), []);
  const transport = useMemo(
    () => createOpenClawChatTransport({ sessionKey, adapter }),
    [sessionKey, adapter],
  );

  const chat = useChat({ id: sessionKey, transport });
  const [input, setInput] = useState("");
  const historyInFlightRef = useRef(false);
  const lastHistoryAtRef = useRef(0);
  const lastHistorySigRef = useRef<string>("");
  const setMessagesRef = useRef(chat.setMessages);

  useEffect(() => {
    // `useChat().setMessages` 在某些版本/实现里可能不是稳定引用，
    // 这里用 ref 避免 `refreshHistory` 因依赖变化导致的 effect 重跑刷屏。
    setMessagesRef.current = chat.setMessages;
  }, [chat.setMessages]);

  const isBusy = chat.status === "submitted" || chat.status === "streaming";

  const refreshHistory = useCallback(async () => {
    if (historyInFlightRef.current) return;
    const now = Date.now();
    // 防止 `chat.final`/热重载等情况下短时间内重复刷历史导致刷屏与 Gateway 压力。
    if (now - lastHistoryAtRef.current < 800) return;
    lastHistoryAtRef.current = now;
    historyInFlightRef.current = true;
    try {
      const connected = await ipc.chat.isConnected();
      if (!connected) {
        const ok = await ipc.chat.connect();
        if (!ok) return;
      }
      const res = (await ipc.chat.request("chat.history", { sessionKey, limit: 200 })) as {
        messages?: unknown;
      };
      const uiMessages = openclawTranscriptToUIMessages(res?.messages);

      // Avoid re-render loops: only update local state if the tail signature changed.
      const last = uiMessages[uiMessages.length - 1];
      const tailText = last?.parts?.find((p) => p.type === "text")?.text ?? "";
      const sig = `${uiMessages.length}:${last?.id ?? ""}:${tailText.length}`;
      if (sig !== lastHistorySigRef.current) {
        lastHistorySigRef.current = sig;
        setMessagesRef.current(uiMessages);
      }
    } catch {
      // best-effort only
    } finally {
      historyInFlightRef.current = false;
    }
  }, [sessionKey]);

  // OpenClaw Control UI: chat.final 到达后用 history 作为权威状态刷新（避免 delta/agent 流丢字段）。
  useEffect(() => {
    void refreshHistory();
  }, [sessionKey, refreshHistory]);

  useEffect(() => {
    return ipc.gateway.onEvent((frame) => {
      if (frame.type !== "event") return;
      if (frame.event !== "chat") return;
      const payload = frame.payload as { sessionKey?: unknown; state?: unknown } | undefined;
      if (!payload || typeof payload !== "object") return;
      if (payload.sessionKey !== sessionKey) return;
      if (payload.state === "final") {
        void refreshHistory();
      }
    });
  }, [sessionKey, refreshHistory]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    await chat.sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Messages */}
      <StickToBottom
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4",
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
            chat.messages.map((message) => {
              const isUser = message.role === "user";
              const streaming = chat.status === "streaming" && message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "min-w-0 max-w-[85%] sm:max-w-[75%]",
                      isUser ? "ml-auto text-right" : "mr-auto text-left",
                    )}
                  >
                    {isUser ? (
                      <div className="inline-block max-w-full rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                        <MessageParts message={message} streaming={false} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="inline-block max-w-full rounded-xl bg-muted px-4 py-3">
                          <MessageParts message={message} streaming={streaming} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
      <div className="border-t p-4">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            className={cn(
              "flex-1 resize-none rounded-lg border bg-background px-4 py-2",
              "min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-ring",
            )}
            rows={1}
            disabled={isBusy}
          />
          <Button onClick={() => void handleSend()} disabled={!input.trim() || isBusy} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <SessionControlStrip sessionKey={sessionKey} disabled={!isGatewayRunning || !wsConnected} />
        </div>
      </div>
    </div>
  );
}
