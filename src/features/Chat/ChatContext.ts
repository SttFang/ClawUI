import { createContext } from "react";
import type {
  ChatFeatureSessionState,
  ChatFeatureSessionActions,
  ChatFeatureUIState,
  ChatFeatureUIActions,
} from "./types";

export type ChatContextValue = {
  sessionState: ChatFeatureSessionState;
  sessionActions: ChatFeatureSessionActions;
  uiState: ChatFeatureUIState;
  uiActions: ChatFeatureUIActions;
};

export const ChatContext = createContext<ChatContextValue | null>(null);
