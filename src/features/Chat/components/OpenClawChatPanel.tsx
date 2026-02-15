import { useChat } from "@ai-sdk/react";
import { createOpenClawChatTransport } from "@clawui/openclaw-chat-stream";
import { Button } from "@clawui/ui";
import { MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { useOpenClawHistorySync } from "@/services/chat/useOpenClawHistorySync";
import { type ComposerImageAttachment, ChatComposer } from "../prompt/ChatComposer";
import { createRendererOpenClawAdapter } from "../utils/openclawAdapter";
import { AssistantMessageItem } from "./AssistantMessageItem";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { SystemMessageItem } from "./SystemMessageItem";
import { UserMessageItem } from "./UserMessageItem";

export function buildMessageWithPendingImagePlaceholders(params: {
  text: string;
  images: ComposerImageAttachment[];
}): string {
  const normalizedText = params.text.trim();
  if (!params.images.length) return normalizedText;

  const imageLines: string[] = [];
  for (const image of params.images) {
    imageLines.push(`- id: ${image.id}`);
    imageLines.push(`  filename: ${image.filename}`);
    imageLines.push(`  mediaType: ${image.mediaType}`);
    imageLines.push(`  size: ${image.size}`);
  }

  const block = ["[image_attachments_pending]", ...imageLines, "[/image_attachments_pending]"].join(
    "\n",
  );
  return normalizedText ? `${normalizedText}\n\n${block}` : block;
}

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
              if (message.role === "system") {
                return (
                  <SystemMessageItem key={key} message={message} sessionKey={effectiveSessionKey} />
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
          onSubmit={async (payload) => {
            const content = buildMessageWithPendingImagePlaceholders(payload);
            if (!content || isBusy) return;
            setInput("");
            if (!hasSession) {
              await onStartConversation(content);
              return;
            }
            await chat.sendMessage({ text: content });
          }}
        />
      </div>
    </div>
  );
}
