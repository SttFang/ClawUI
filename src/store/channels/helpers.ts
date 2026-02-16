import type { ChannelConfig } from "@/lib/ipc";
import type { Channel, ChannelType } from "./types";

type JsonObject = Record<string, unknown>;
const EDITABLE_CHANNELS = new Set<string>(["telegram", "discord"]);

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
    config.dmPolicy = (readString(dm?.policy) ??
      readString(source.dmPolicy)) as ChannelConfig["dmPolicy"];
    config.allowFrom = toStringArray(dm?.allowFrom) ?? toStringArray(source.allowFrom);
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

export function mapSnapshotToChannels(baseChannels: Channel[], config: unknown): Channel[] {
  const root = asRecord(config) ?? {};
  const channels = asRecord(root.channels) ?? {};
  const baseMapped = baseChannels.map((channel) => {
    const channelConfig = mapActualChannelToUi(channel.type, channels[channel.type]);
    return {
      ...channel,
      isConfigured: Boolean(channelConfig),
      isEnabled: channelConfig?.enabled ?? false,
      config: channelConfig,
    };
  });

  const knownTypes = new Set(baseMapped.map((channel) => channel.type));
  const discovered = Object.keys(channels)
    .filter((channelType) => !knownTypes.has(channelType))
    .map((channelType) => {
      const channelConfig = mapActualChannelToUi(channelType, channels[channelType]);
      return {
        type: channelType as ChannelType,
        name: channelType,
        description: `Discovered from openclaw.json: ${channelType}`,
        icon: "🔌",
        isEditable: false,
        isConfigured: Boolean(channelConfig),
        isEnabled: channelConfig?.enabled ?? false,
        config: channelConfig,
      } satisfies Channel;
    });

  return [...baseMapped, ...discovered];
}

export function buildActualChannelPatch(
  type: ChannelType,
  config: ChannelConfig,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
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

  if (!EDITABLE_CHANNELS.has(type)) {
    return patch;
  }

  if (typeof config.botToken === "string") patch.botToken = config.botToken;
  if (typeof config.appToken === "string") patch.appToken = config.appToken;
  if (typeof config.dmPolicy === "string") patch.dmPolicy = config.dmPolicy;
  if (Array.isArray(config.allowFrom)) patch.allowFrom = [...config.allowFrom];
  if (typeof config.requireMention === "boolean") patch.requireMention = config.requireMention;
  return patch;
}
