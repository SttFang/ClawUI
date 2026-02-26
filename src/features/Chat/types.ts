import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import type { UIMessage } from "ai";

export type SessionSource =
  | "ui"
  | "discord"
  | "telegram"
  | "slack"
  | "whatsapp"
  | "signal"
  | "irc"
  | "googlechat"
  | "imessage"
  | "acp"
  | "cron"
  | "unknown";

export type SessionListItem = {
  id: string;
  name: string;
  updatedAt: number;
  surface?: string | null;
};

export type ChatFeatureSessionState = {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  sessionMetadata: Record<string, ClawUISessionMetadata>;
  metaBusyByKey: Record<string, boolean>;
};

export type ChatFeatureSessionActions = {
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
  onStartConversation: () => Promise<string>;
};

export type MessagePartsProps = { message: UIMessage; streaming: boolean };
