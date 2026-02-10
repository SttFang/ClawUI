import type { Message, Session } from "./initialState";
import type { ChatStore } from "./store";

export const selectCurrentSession = (state: ChatStore): Session | undefined =>
  state.sessions.find((s) => s.id === state.currentSessionId);

const EMPTY_MESSAGES: Message[] = [];
export const selectMessages = (state: ChatStore): Message[] => {
  const session = state.sessions.find((s) => s.id === state.currentSessionId);
  return session?.messages ?? EMPTY_MESSAGES;
};

export const selectSessions = (state: ChatStore) => state.sessions;
export const selectIsLoading = (state: ChatStore) => state.isLoading;
export const selectInput = (state: ChatStore) => state.input;
export const selectWsConnected = (state: ChatStore) => state.wsConnected;

export const chatSelectors = {
  selectCurrentSession,
  selectMessages,
  selectSessions,
  selectIsLoading,
  selectInput,
  selectWsConnected,
};
