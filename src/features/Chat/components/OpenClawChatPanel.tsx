import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { createOpenClawChatTransport } from "@clawui/openclaw-chat-stream";
import { Button } from "@clawui/ui";
import { BookmarkIcon, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { useOpenClawHistorySync } from "@/services/chat/useOpenClawHistorySync";
import { useChatStore, selectSessionsInitialized } from "@/store/chat";
import { selectIsCompacting, useCompactionStore } from "@/store/compaction";
import { type ComposerImageAttachment, ChatComposer } from "../prompt/ChatComposer";
import { createRendererOpenClawAdapter } from "../utils/openclawAdapter";
import { AssistantMessageItem } from "./AssistantMessageItem";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { SystemMessageItem } from "./SystemMessageItem";
import { UserMessageItem } from "./UserMessageItem";

const COMPACTION_RE = /^(⚙️\s*)?compact(ion|ed)\b/i;

/** Extract plain text from a UIMessage (first text part only). */
function extractPlainText(message: UIMessage): string {
  for (const part of message.parts) {
    if (part.type === "text" && typeof part.text === "string") return part.text.trim();
  }
  return "";
}

/** True when the message is a Gateway compaction notice (system or assistant). */
export function isCompactionMessage(message: UIMessage): boolean {
  if (message.role === "user") return false;
  return COMPACTION_RE.test(extractPlainText(message));
}

/** True when the message is a Gateway-injected subagent announce (role=user). */
const SUBAGENT_ANNOUNCE_RE =
  /^(\[System Message\].*)?A (subagent task|cron job) ".+" just (completed|timed out|failed|finished)/;

export function isSubagentAnnounceMessage(message: UIMessage): boolean {
  if (message.role !== "user") return false;
  return SUBAGENT_ANNOUNCE_RE.test(extractPlainText(message));
}

function CompactionCheckpoint(props: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden text-muted-foreground">
      <BookmarkIcon className="size-3.5 shrink-0" />
      <span className="shrink-0 text-xs">{props.text}</span>
      <hr className="flex-1 border-t border-border" />
    </div>
  );
}

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
  onStartConversation: () => Promise<string>;
}) {
  const { sessionKey, wsConnected, isGatewayRunning, onStartConversation } = props;
  const { t } = useTranslation("chat");
  const { t: tCommon } = useTranslation("common");
  const sessionsInitialized = useChatStore(selectSessionsInitialized);
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
  const pendingMessageRef = useRef<string | null>(null);

  const isStreaming = chat.status === "streaming";
  const isCompacting = useCompactionStore(selectIsCompacting(effectiveSessionKey));

  // Flush pending message once session becomes active
  useEffect(() => {
    if (hasSession && pendingMessageRef.current) {
      const text = pendingMessageRef.current;
      pendingMessageRef.current = null;
      void chat.sendMessage({ text });
    }
  }, [hasSession, chat]);

  useOpenClawHistorySync({
    sessionKey: normalizedSessionKey,
    hasSession,
    setMessages: chat.setMessages,
    isStreaming,
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
          "relative min-h-0 flex-1 overflow-hidden overscroll-contain px-4 pt-4 pb-4",
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
                // Hide Gateway-injected subagent announce messages
                if (isSubagentAnnounceMessage(message)) return null;
                return (
                  <UserMessageItem key={key} message={message} sessionKey={effectiveSessionKey} />
                );
              }

              if (isCompactionMessage(message)) {
                return <CompactionCheckpoint key={key} text={extractPlainText(message)} />;
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

          {isCompacting ? (
            <div className="flex items-center gap-1.5 overflow-hidden text-muted-foreground">
              <BookmarkIcon className="size-3.5 shrink-0 animate-pulse" />
              <span className="claw-text-shimmer shrink-0 text-xs">
                {tCommon("compaction.active")}
              </span>
              <hr className="flex-1 border-t border-border" />
            </div>
          ) : null}

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
          disabled={isBusy || !isGatewayRunning || !wsConnected || !sessionsInitialized}
          showSessionControls={hasSession}
          sessionControlsDisabled={!hasSession || !isGatewayRunning || !wsConnected}
          onSubmit={async (payload) => {
            const content = buildMessageWithPendingImagePlaceholders(payload);
            if (!content || isBusy) return;
            setInput("");
            if (!hasSession) {
              pendingMessageRef.current = content;
              await onStartConversation();
              return;
            }
            await chat.sendMessage({ text: content });
          }}
        />
      </div>
    </div>
  );
}
