import { create, type StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
import { type ChatStoreState, initialState } from "./initialState";
import { type MessageAction, messageSlice } from "./slices/message/action";
import { type SessionAction, sessionSlice } from "./slices/session/action";
import { type TransportAction, transportSlice } from "./slices/transport/action";

export interface ChatStoreAction extends SessionAction, MessageAction, TransportAction {}

export type ChatStore = ChatStoreState & ChatStoreAction;

const createChatStore: StateCreator<ChatStore, [["zustand/devtools", never]]> = (...params) => ({
  ...initialState,
  ...sessionSlice(...params),
  ...messageSlice(...params),
  ...transportSlice(...params),
});

export const useChatStore = create<ChatStore>()(devtools(createChatStore, { name: "ChatStore" }));
