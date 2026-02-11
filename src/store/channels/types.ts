import type { ChannelConfig } from "@/lib/ipc";

export type ChannelType = "telegram" | "discord" | "whatsapp" | "slack" | "wechat" | "signal";

export interface Channel {
  type: ChannelType;
  name: string;
  description: string;
  icon: string;
  isConfigured: boolean;
  isEnabled: boolean;
  config: ChannelConfig | null;
}

export interface ChannelsState {
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
}

export interface ChannelsPublicActions {
  loadChannels: () => Promise<void>;
  enableChannel: (type: ChannelType) => Promise<void>;
  disableChannel: (type: ChannelType) => Promise<void>;
  configureChannel: (type: ChannelType, config: ChannelConfig) => Promise<void>;
  setError: (error: string | null) => void;
}

export interface ChannelsInternalActions {
  internal_dispatchChannels: (updater: (channels: Channel[]) => Channel[], action: string) => void;
  internal_applyPatch: (patch: Record<string, unknown>) => Promise<void>;
}

export type ChannelsStore = ChannelsState & ChannelsPublicActions & ChannelsInternalActions;
