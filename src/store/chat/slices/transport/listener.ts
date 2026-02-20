import { ipc, ChatStreamEvent } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { useChatStore } from "../../store";

let chatStreamListenerInitialized = false;

export function initChatStreamListener() {
  if (chatStreamListenerInitialized || typeof window === "undefined") return;
  chatStreamListenerInitialized = true;

  ipc.chat.onStream((event: ChatStreamEvent) => {
    const { updateStreamingMessage, setMessageStreaming, removeLoadingMessage } =
      useChatStore.getState();

    if (event.type === "start") {
      // Stream started
    } else if (event.type === "delta") {
      if (event.content) {
        updateStreamingMessage(event.messageId, event.content);
      }
    } else if (event.type === "end") {
      setMessageStreaming(event.messageId, false);
      removeLoadingMessage(event.messageId);
    } else if (event.type === "error") {
      const { updateMessage } = useChatStore.getState();
      updateMessage(event.messageId, `Error: ${event.error || "Unknown error"}`);
      removeLoadingMessage(event.messageId);
    }
  });

  ipc.chat.onConnected(() => {
    useChatStore.getState().setWsConnected(true);
  });

  ipc.chat.onDisconnected(() => {
    useChatStore.getState().setWsConnected(false);
  });

  ipc.chat.onReconnected(() => {
    useChatStore.getState().setWsConnected(true);
  });

  ipc.chat.onError((error: string) => {
    chatLog.error("WebSocket error:", error);
  });
}
