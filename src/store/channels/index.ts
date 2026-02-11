import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, ChannelConfig } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";

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

interface ChannelsState {
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
}

interface ChannelsActions {
  loadChannels: () => Promise<void>;
  enableChannel: (type: ChannelType) => Promise<void>;
  disableChannel: (type: ChannelType) => Promise<void>;
  configureChannel: (type: ChannelType, config: ChannelConfig) => Promise<void>;
  setError: (error: string | null) => void;
}

type ChannelsStore = ChannelsState & ChannelsActions;

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((entry): entry is string => typeof entry === "string");
  return items.length > 0 ? items : [];
}

function resolveEffectiveChannelConfig(channelValue: unknown): JsonObject | null {
  const channel = asRecord(channelValue);
  if (!channel) return null;

  const base: JsonObject = { ...channel };
  delete base.accounts;

  const accounts = asRecord(channel.accounts);
  const defaultAccount = accounts ? asRecord(accounts.default) : null;
  let selectedAccount = defaultAccount;
  if (!selectedAccount && accounts) {
    for (const entry of Object.values(accounts)) {
      const account = asRecord(entry);
      if (account) {
        selectedAccount = account;
        break;
      }
    }
  }

  return selectedAccount ? { ...base, ...selectedAccount } : base;
}

function readRequireMention(channelId: string, source: JsonObject): boolean | undefined {
  const direct = readBoolean(source.requireMention);
  if (typeof direct === "boolean") return direct;

  if (channelId === "telegram" || channelId === "whatsapp") {
    const groups = asRecord(source.groups);
    const star = groups ? asRecord(groups["*"]) : null;
    return readBoolean(star?.requireMention);
  }

  if (channelId === "discord") {
    const guilds = asRecord(source.guilds);
    const star = guilds ? asRecord(guilds["*"]) : null;
    return readBoolean(star?.requireMention);
  }

  return undefined;
}

function mapActualChannelToUi(channelId: string, rawChannel: unknown): ChannelConfig | null {
  const source = resolveEffectiveChannelConfig(rawChannel);
  if (!source) return null;

  const config: ChannelConfig = {
    enabled: readBoolean(source.enabled) ?? true,
    dmPolicy: undefined,
    groupPolicy: undefined,
  };

  if (channelId === "telegram") {
    config.botToken = readString(source.botToken);
    config.dmPolicy = readString(source.dmPolicy) as ChannelConfig["dmPolicy"];
    config.allowFrom = toStringArray(source.allowFrom);
  } else if (channelId === "discord") {
    config.botToken = readString(source.token);
    const dm = asRecord(source.dm);
    config.dmPolicy = readString(dm?.policy) as ChannelConfig["dmPolicy"];
    config.allowFrom = toStringArray(dm?.allowFrom);
  } else if (channelId === "slack") {
    config.botToken = readString(source.botToken);
    config.appToken = readString(source.appToken);
    const dm = asRecord(source.dm);
    config.dmPolicy = readString(dm?.policy) as ChannelConfig["dmPolicy"];
    config.allowFrom = toStringArray(dm?.allowFrom);
  } else if (channelId === "whatsapp") {
    config.dmPolicy = readString(source.dmPolicy) as ChannelConfig["dmPolicy"];
    config.allowFrom = toStringArray(source.allowFrom);
  }

  config.groupPolicy = readString(source.groupPolicy) as ChannelConfig["groupPolicy"];
  config.requireMention = readRequireMention(channelId, source);
  config.historyLimit = readNumber(source.historyLimit);
  config.mediaMaxMb = readNumber(source.mediaMaxMb);
  return config;
}

function buildActualChannelPatch(type: ChannelType, config: ChannelConfig): JsonObject {
  const patch: JsonObject = {
    enabled: config.enabled,
  };

  if (typeof config.groupPolicy === "string") patch.groupPolicy = config.groupPolicy;
  if (typeof config.historyLimit === "number") patch.historyLimit = config.historyLimit;
  if (typeof config.mediaMaxMb === "number") patch.mediaMaxMb = config.mediaMaxMb;

  if (type === "telegram") {
    if (typeof config.botToken === "string") patch.botToken = config.botToken;
    if (typeof config.dmPolicy === "string") patch.dmPolicy = config.dmPolicy;
    if (Array.isArray(config.allowFrom)) patch.allowFrom = [...config.allowFrom];
    if (typeof config.requireMention === "boolean") {
      patch.groups = { "*": { requireMention: config.requireMention } };
    }
    return patch;
  }

  if (type === "discord") {
    if (typeof config.botToken === "string") patch.token = config.botToken;
    if (typeof config.dmPolicy === "string" || Array.isArray(config.allowFrom)) {
      patch.dm = {
        ...(typeof config.dmPolicy === "string" ? { policy: config.dmPolicy } : {}),
        ...(Array.isArray(config.allowFrom) ? { allowFrom: [...config.allowFrom] } : {}),
      };
    }
    if (typeof config.requireMention === "boolean") {
      patch.guilds = { "*": { requireMention: config.requireMention } };
    }
    return patch;
  }

  if (type === "slack") {
    if (typeof config.botToken === "string") patch.botToken = config.botToken;
    if (typeof config.appToken === "string") patch.appToken = config.appToken;
    if (typeof config.dmPolicy === "string" || Array.isArray(config.allowFrom)) {
      patch.dm = {
        ...(typeof config.dmPolicy === "string" ? { policy: config.dmPolicy } : {}),
        ...(Array.isArray(config.allowFrom) ? { allowFrom: [...config.allowFrom] } : {}),
      };
    }
    return patch;
  }

  if (type === "whatsapp") {
    if (typeof config.dmPolicy === "string") patch.dmPolicy = config.dmPolicy;
    if (Array.isArray(config.allowFrom)) patch.allowFrom = [...config.allowFrom];
    if (typeof config.requireMention === "boolean") {
      patch.groups = { "*": { requireMention: config.requireMention } };
    }
    return patch;
  }

  if (typeof config.botToken === "string") patch.botToken = config.botToken;
  if (typeof config.appToken === "string") patch.appToken = config.appToken;
  if (typeof config.dmPolicy === "string") patch.dmPolicy = config.dmPolicy;
  if (Array.isArray(config.allowFrom)) patch.allowFrom = [...config.allowFrom];
  if (typeof config.requireMention === "boolean") patch.requireMention = config.requireMention;
  return patch;
}

const defaultChannels: Channel[] = [
  {
    type: "telegram",
    name: "Telegram",
    description: "Connect your Telegram bot",
    icon: "📱",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: "discord",
    name: "Discord",
    description: "Connect your Discord bot",
    icon: "🎮",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: "whatsapp",
    name: "WhatsApp",
    description: "Connect to WhatsApp",
    icon: "💬",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: "slack",
    name: "Slack",
    description: "Connect your Slack workspace",
    icon: "💼",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: "wechat",
    name: "WeChat",
    description: "Connect to WeChat",
    icon: "🟢",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: "signal",
    name: "Signal",
    description: "Connect to Signal",
    icon: "🔒",
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
];

const initialState: ChannelsState = {
  channels: defaultChannels,
  isLoading: false,
  error: null,
};

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadChannels: async () => {
        set({ isLoading: true, error: null }, false, "loadChannels");
        try {
          const snapshot = await ipc.config.getSnapshot();
          const root = asRecord(snapshot.config) ?? {};
          const channels = asRecord(root.channels) ?? {};
          set(
            (state) => ({
              channels: state.channels.map((channel) => {
                const channelConfig = mapActualChannelToUi(channel.type, channels[channel.type]);
                return {
                  ...channel,
                  isConfigured: Boolean(channelConfig),
                  isEnabled: channelConfig?.enabled ?? false,
                  config: channelConfig,
                };
              }),
              isLoading: false,
            }),
            false,
            "loadChannels/success",
          );
        } catch (error) {
          set(
            {
              isLoading: false,
              error: error instanceof Error ? error.message : "Failed to load channels",
            },
            false,
            "loadChannels/error",
          );
        }
      },

      enableChannel: async (type) => {
        const channel = get().channels.find((c) => c.type === type);
        if (!channel?.config) return;

        try {
          await useConfigDraftStore.getState().applyPatch({
            channels: {
              [type]: buildActualChannelPatch(type, { ...channel.config, enabled: true }),
            },
          });
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.type === type ? { ...c, isEnabled: true } : c,
              ),
            }),
            false,
            "enableChannel",
          );
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : "Failed to enable channel" },
            false,
            "enableChannel/error",
          );
        }
      },

      disableChannel: async (type) => {
        try {
          await useConfigDraftStore.getState().applyPatch({
            channels: {
              [type]: { enabled: false },
            },
          });
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.type === type ? { ...c, isEnabled: false } : c,
              ),
            }),
            false,
            "disableChannel",
          );
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : "Failed to disable channel" },
            false,
            "disableChannel/error",
          );
        }
      },

      configureChannel: async (type, config) => {
        try {
          await useConfigDraftStore.getState().applyPatch({
            channels: {
              [type]: buildActualChannelPatch(type, config),
            },
          });
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.type === type
                  ? {
                      ...c,
                      isConfigured: true,
                      isEnabled: config.enabled,
                      config,
                    }
                  : c,
              ),
            }),
            false,
            "configureChannel",
          );
        } catch (error) {
          set(
            { error: error instanceof Error ? error.message : "Failed to configure channel" },
            false,
            "configureChannel/error",
          );
        }
      },

      setError: (error) => set({ error }, false, "setError"),
    }),
    { name: "ChannelsStore" },
  ),
);

// Selectors
export const selectChannels = (state: ChannelsStore) => state.channels;
export const selectEnabledChannels = createWeakCachedSelector((state: ChannelsStore) =>
  state.channels.filter((c) => c.isEnabled),
);
export const selectConfiguredChannels = createWeakCachedSelector((state: ChannelsStore) =>
  state.channels.filter((c) => c.isConfigured),
);
export const selectChannelByType = (type: ChannelType) => (state: ChannelsStore) =>
  state.channels.find((c) => c.type === type);

export const channelsSelectors = {
  selectChannels,
  selectEnabledChannels,
  selectConfiguredChannels,
  selectChannelByType,
};
