import { useChat } from "@ai-sdk/react";
import { createOpenClawChatTransport } from "@clawui/claw-sse";
import { Button } from "@clawui/ui";
import { MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { useOpenClawHistorySync } from "@/services/chat/useOpenClawHistorySync";
import { ChatComposer } from "../prompt/ChatComposer";
import { createRendererOpenClawAdapter } from "../utils/openclawAdapter";
import { AssistantMessageItem } from "./AssistantMessageItem";
import { RunTimelinePanel } from "./RunTimelinePanel";
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

  useOpenClawHistorySync({
    sessionKey: normalizedSessionKey,
    hasSession,
    setMessages: chat.setMessages,
  });

  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const activeAssistantMessageId = useMemo(() => {
    if (chat.status !== "streaming") return null;
    for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
      const message = chat.messages[i];
      if (message?.role === "assistant") return message.id;
    }
    return null;
  }, [chat.messages, chat.status]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Messages */}
      <StickToBottom
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pt-4 pb-4",
          // 允许触控/触控板在该区域垂直滚动
          "touch-pan-y",
        )}
        resize="smooth"
        initial="smooth"
      >
        <StickToBottom.Content className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-1">
          {hasSession && chat.messages.length > 0 ? (
            <RunTimelinePanel sessionKey={normalizedSessionKey} />
          ) : null}
          {chat.messages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{t("emptyTitle")}</p>
              <p className="mt-2 text-sm">
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
