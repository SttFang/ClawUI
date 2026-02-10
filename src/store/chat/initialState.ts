import { type MessageState, initialMessageState } from "./slices/message/initialState";
import { type SessionState, initialSessionState } from "./slices/session/initialState";
import { type TransportState, initialTransportState } from "./slices/transport/initialState";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  surface?: string | null;
}

export type ChatStoreState = SessionState & MessageState & TransportState;

export const initialState: ChatStoreState = {
  ...initialSessionState,
  ...initialMessageState,
  ...initialTransportState,
};
