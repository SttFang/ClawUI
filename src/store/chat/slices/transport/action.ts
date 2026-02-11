import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { disconnectChat, ensureChatConnected } from "@/services/chat/connection";
import type { ChatStore } from "../../store";
import { generateChatRunId } from "../../helpers";

export interface TransportAction {
  connectWebSocket: (url?: string) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  syncWsStatus: () => Promise<void>;
  setInput: (input: string) => void;
  setWsConnected: (connected: boolean) => void;
}

export const transportSlice: StateCreator<
  ChatStore,
  [["zustand/devtools", never]],
  [],
  TransportAction
> = (set, get) => ({
  setInput: (input) => set({ input }, false, "setInput"),
  setWsConnected: (wsConnected) => set({ wsConnected }, false, "setWsConnected"),

  syncWsStatus: async () => {
    try {
      const ok = await ipc.chat.isConnected();
      set({ wsConnected: ok }, false, "syncWsStatus");
    } catch {
      // ignore – best-effort sync
    }
  },

  connectWebSocket: async (url) => {
    try {
      await ensureChatConnected(url);
    } catch (error) {
      chatLog.error("Failed to connect WebSocket:", error);
    }
  },

  disconnectWebSocket: async () => {
    try {
      await disconnectChat();
    } catch (error) {
      chatLog.error("Failed to disconnect WebSocket:", error);
    }
  },

  sendMessage: async (content) => {
    const {
      addMessage,
      addLoadingMessage,
      removeLoadingMessage,
      updateMessage,
      currentSessionId,
      createSession,
      wsConnected,
    } = get();

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    const runId = generateChatRunId();

    addMessage({ role: "user", content });
    set({ input: "" }, false, "sendMessage/clearInput");
    addLoadingMessage(runId);
    set(
      (state) => {
        const sid = state.currentSessionId;
        if (!sid) return state;

        return {
          sessions: state.sessions.map((s) =>
            s.id === sid
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: runId,
                      role: "assistant" as const,
                      content: "",
                      timestamp: Date.now(),
                      isStreaming: true,
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : s,
          ),
        };
      },
      false,
      "sendMessage/placeholder",
    );

    try {
      if (wsConnected) {
        await ipc.chat.send({
          sessionId: sessionId!,
          message: content,
          messageId: runId,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateMessage(runId, "WebSocket not connected. Please connect to the gateway first.");
        removeLoadingMessage(runId);
      }
    } catch (error) {
      chatLog.error("Failed to send message:", error);
      updateMessage(runId, "Error: Failed to send message to gateway.");
      removeLoadingMessage(runId);
    }
  },
});
