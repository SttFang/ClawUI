import { useMemo } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { AssistantMessageItem } from "@/features/Chat/components/AssistantMessageItem";
import { ScrollToBottomButton } from "@/features/Chat/components/ScrollToBottomButton";
import { UserMessageItem } from "@/features/Chat/components/UserMessageItem";
import { useRescueStore, selectRescueMessages } from "@/store/rescue";
import { rescueToUIMessage } from "./rescueAdapter";

export function RescueMessageList() {
  const messages = useRescueStore(selectRescueMessages);

  const uiMessages = useMemo(() => messages.map(rescueToUIMessage), [messages]);

  const streamingMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].isStreaming) return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <StickToBottom
      className="relative min-h-0 flex-1 overflow-hidden overscroll-contain px-4 pt-4 pb-4 touch-pan-y"
      resize="smooth"
      initial="smooth"
    >
      <StickToBottom.Content className="flex w-full flex-col gap-6">
        {uiMessages.map((msg) =>
          msg.role === "user" ? (
            <UserMessageItem key={msg.id} message={msg} sessionKey="rescue" />
          ) : (
            <AssistantMessageItem
              key={msg.id}
              message={msg}
              sessionKey="rescue"
              streaming={msg.id === streamingMessageId}
            />
          ),
        )}
      </StickToBottom.Content>

      <ScrollToBottomButton />
    </StickToBottom>
  );
}
