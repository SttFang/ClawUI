import type { StateCreator } from "zustand";
import type { ChatStore } from "../../store";
import { generateMessageId } from "../../helpers";

export interface MessageAction {
  addMessage: (message: Omit<import("../../initialState").Message, "id" | "timestamp">) => void;
  updateMessage: (id: string, content: string) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  appendMessageContent: (id: string, content: string) => void;
  setMessageStreaming: (id: string, isStreaming: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const messageSlice: StateCreator<
  ChatStore,
  [["zustand/devtools", never]],
  [],
  MessageAction
> = (set, get) => ({
  addMessage: (message) => {
    const { currentSessionId, createSession } = get();
    let sessionId = currentSessionId;

    if (!sessionId) {
      sessionId = createSession();
    }

    const newMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    };

    set(
      (state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [...s.messages, newMessage],
                updatedAt: Date.now(),
              }
            : s,
        ),
      }),
      false,
      "addMessage",
    );
  },

  updateMessage: (id, content) =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content, isStreaming: false } : m,
          ),
        })),
      }),
      false,
      "updateMessage",
    ),

  updateStreamingMessage: (id, content) =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== id) return m;
            if (!m.content || content.length >= m.content.length) {
              return { ...m, content };
            }
            return m;
          }),
        })),
      }),
      false,
      "updateStreamingMessage",
    ),

  appendMessageContent: (id, content) =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + content } : m,
          ),
        })),
      }),
      false,
      "appendMessageContent",
    ),

  setMessageStreaming: (id, isStreaming) =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) => ({
          ...s,
          messages: s.messages.map((m) => (m.id === id ? { ...m, isStreaming } : m)),
        })),
      }),
      false,
      "setMessageStreaming",
    ),

  setLoading: (isLoading) => set({ isLoading }, false, "setLoading"),
});
