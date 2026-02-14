import { useContext } from "react";
import { ChatContext, type ChatContextValue } from "./ChatContext";

export function useChatFeature(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatFeature must be used within <ChatProvider>");
  }
  return ctx;
}
