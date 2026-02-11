import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import type { UIMessage } from "ai";

export type SessionSource =
  | "ui"
  | "discord"
  | "telegram"
  | "slack"
  | "whatsapp"
  | "wechat"
  | "signal"
  | "cron"
  | "unknown";

export type SessionFilter = "ui" | "discord" | "channels" | "all";

export type SessionListItem = {
  id: string;
  name: string;
  updatedAt: number;
  surface?: string | null;
};

export type ChatFeatureSessionState = {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  sessionFilter: SessionFilter;
  sessionMetadata: Record<string, ClawUISessionMetadata>;
  metaBusyByKey: Record<string, boolean>;
};

export type ChatFeatureSessionActions = {
  onSessionFilterChange: (filter: SessionFilter) => void;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, label: string) => void;
  onDeleteSession: (id: string) => void;
  onGenerateMetadata: (id: string) => void;
};

export type ChatFeatureUIState = {
  wsConnected: boolean;
  isGatewayRunning: boolean;
  configValid: boolean | null;
  showBanner: boolean;
};

export type ChatFeatureUIActions = {
  onDismissBanner: () => void;
  onOneClickConfig: () => void;
  onManualConfig: () => void;
  onStartConversation: (content: string) => Promise<void>;
};

export type ChatFeatureProps = {
  sessionState: ChatFeatureSessionState;
  sessionActions: ChatFeatureSessionActions;
  uiState: ChatFeatureUIState;
  uiActions: ChatFeatureUIActions;
};

export type MessagePartsProps = { message: UIMessage; streaming: boolean };
