import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import JSON5 from "json5";
import { dirname } from "path";
import { configLog } from "../lib/logger";

type LegacyDmPolicy = "pairing" | "allowlist" | "open" | "disabled";
type LegacyGroupPolicy = "allowlist" | "open" | "disabled";
type LegacySessionScope = "per-sender" | "per-channel-peer" | "main";
type LegacyResetMode = "idle" | "daily";
type LegacyToolAccess = "auto" | "ask" | "deny";

type LegacyChannelConfig = {
  enabled: boolean;
  botToken?: string;
  appToken?: string;
  dmPolicy?: LegacyDmPolicy;
  groupPolicy?: LegacyGroupPolicy;
  requireMention?: boolean;
  historyLimit?: number;
  allowFrom?: string[];
  mediaMaxMb?: number;
};

export type LegacyOpenClawConfig = {
  gateway: {
    port: number;
    bind: string;
    token: string;
  };
  agents: {
    defaults: {
      workspace: string;
      model: {
        primary: string;
        fallbacks: string[];
      };
      sandbox: { enabled: boolean };
    };
  };
  session: {
    scope: LegacySessionScope;
    store: string;
    reset: {
      mode: LegacyResetMode;
      idleMinutes: number;
    };
  };
  channels: {
    telegram?: LegacyChannelConfig;
    discord?: LegacyChannelConfig;
    whatsapp?: LegacyChannelConfig;
    slack?: LegacyChannelConfig;
    [key: string]: LegacyChannelConfig | undefined;
  };
  tools: {
    access: LegacyToolAccess;
    allow: string[];
    deny: string[];
    sandbox: { enabled: boolean };
  };
  providers: Record<string, unknown>;
  env: Record<string, string>;
  cron: {
    enabled: boolean;
    store: string;
  };
  hooks: {
    enabled: boolean;
    token: string;
    path: string;
  };
};

type JsonObject = Record<string, unknown>;

const CHANNEL_IDS = ["telegram", "discord", "whatsapp", "slack"] as const;
const DM_POLICIES = new Set<LegacyDmPolicy>(["pairing", "allowlist", "open", "disabled"]);
const GROUP_POLICIES = new Set<LegacyGroupPolicy>(["allowlist", "open", "disabled"]);
const SESSION_SCOPES = new Set<LegacySessionScope>(["per-sender", "per-channel-peer", "main"]);
const SESSION_RESET_MODES = new Set<LegacyResetMode>(["idle", "daily"]);
const TOOL_ACCESS_MODES = new Set<LegacyToolAccess>(["auto", "ask", "deny"]);

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function ensureRecord(target: JsonObject, key: string): JsonObject {
  const existing = asRecord(target[key]);
  if (existing) return existing;
  const next: JsonObject = {};
  target[key] = next;
  return next;
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
  const items = value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
      return "";
    })
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [];
}

function readPolicy<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.has(value as T) ? (value as T) : undefined;
}

function flattenEnvVars(envValue: unknown): Record<string, string> {
  const env = asRecord(envValue);
  if (!env) return {};

  const out: Record<string, string> = {};
  const vars = asRecord(env.vars);
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === "string") out[key] = value;
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (key === "vars" || key === "shellEnv") continue;
    if (typeof value === "string") out[key] = value;
  }

  return out;
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

function resolveLegacyRequireMention(channelId: string, source: JsonObject): boolean | undefined {
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

function mapChannelToLegacy(
  channelId: string,
  rawChannel: unknown,
): LegacyChannelConfig | undefined {
  const source = resolveEffectiveChannelConfig(rawChannel);
  if (!source) return undefined;

  const legacy: LegacyChannelConfig = {
    enabled: readBoolean(source.enabled) ?? true,
  };

  if (channelId === "telegram") {
    legacy.botToken = readString(source.botToken);
    legacy.dmPolicy = readPolicy(source.dmPolicy, DM_POLICIES);
    legacy.allowFrom = toStringArray(source.allowFrom);
  } else if (channelId === "discord") {
    legacy.botToken = readString(source.token);
    const dm = asRecord(source.dm);
    legacy.dmPolicy = readPolicy(dm?.policy, DM_POLICIES);
    legacy.allowFrom = toStringArray(dm?.allowFrom);
  } else if (channelId === "slack") {
    legacy.botToken = readString(source.botToken);
    legacy.appToken = readString(source.appToken);
    const dm = asRecord(source.dm);
    legacy.dmPolicy = readPolicy(dm?.policy, DM_POLICIES);
    legacy.allowFrom = toStringArray(dm?.allowFrom);
  } else if (channelId === "whatsapp") {
    legacy.dmPolicy = readPolicy(source.dmPolicy, DM_POLICIES);
    legacy.allowFrom = toStringArray(source.allowFrom);
  }

  legacy.groupPolicy = readPolicy(source.groupPolicy, GROUP_POLICIES);
  legacy.requireMention = resolveLegacyRequireMention(channelId, source);
  legacy.historyLimit = readNumber(source.historyLimit);
  legacy.mediaMaxMb = readNumber(source.mediaMaxMb);

  return legacy;
}

function sandboxEnabledFromActual(actual: JsonObject): boolean {
  const agents = asRecord(actual.agents);
  const defaults = agents ? asRecord(agents.defaults) : null;
  const sandbox = defaults ? asRecord(defaults.sandbox) : null;
  if (!sandbox) return false;
  const enabled = readBoolean(sandbox.enabled);
  if (typeof enabled === "boolean") return enabled;
  const mode = readString(sandbox.mode);
  if (!mode) return false;
  return mode !== "off";
}

function deriveToolAccess(actualTools: JsonObject): LegacyToolAccess {
  const deny = toStringArray(actualTools.deny) ?? [];
  if (deny.includes("*")) return "deny";
  const exec = asRecord(actualTools.exec);
  const ask = readString(exec?.ask);
  if (ask === "always") return "ask";
  return "auto";
}

export class OpenClawConfigBridge {
  constructor(private readonly configPath: string) {}

  getConfigPath(): string {
    return this.configPath;
  }

  async getLegacyConfig(): Promise<LegacyOpenClawConfig> {
    const actual = await this.readActualConfig();
    const gateway = asRecord(actual.gateway);
    const gatewayAuth = gateway ? asRecord(gateway.auth) : null;
    const agents = asRecord(actual.agents);
    const defaults = agents ? asRecord(agents.defaults) : null;
    const model = defaults ? asRecord(defaults.model) : null;
    const session = asRecord(actual.session);
    const reset = session ? asRecord(session.reset) : null;
    const tools = asRecord(actual.tools) ?? {};
    const channels = asRecord(actual.channels);
    const cron = asRecord(actual.cron);
    const hooks = asRecord(actual.hooks);

    const mappedChannels: LegacyOpenClawConfig["channels"] = {};
    for (const channelId of CHANNEL_IDS) {
      const mapped = mapChannelToLegacy(channelId, channels?.[channelId]);
      if (mapped) {
        mappedChannels[channelId] = mapped;
      }
    }

    return {
      gateway: {
        port: readNumber(gateway?.port) ?? 18789,
        bind: readString(gateway?.bind) ?? "loopback",
        token: readString(gatewayAuth?.token) ?? "",
      },
      agents: {
        defaults: {
          workspace: readString(defaults?.workspace) ?? "~/.openclaw/workspace",
          model: {
            primary: readString(model?.primary) ?? "",
            fallbacks: toStringArray(model?.fallbacks) ?? [],
          },
          sandbox: { enabled: sandboxEnabledFromActual(actual) },
        },
      },
      session: {
        scope: readPolicy(session?.scope, SESSION_SCOPES) ?? "per-sender",
        store: readString(session?.store) ?? "~/.openclaw/agents/{agentId}/sessions/sessions.json",
        reset: {
          mode: readPolicy(reset?.mode, SESSION_RESET_MODES) ?? "idle",
          idleMinutes: readNumber(reset?.idleMinutes) ?? 60,
        },
      },
      channels: mappedChannels,
      tools: {
        access: deriveToolAccess(tools),
        allow: toStringArray(tools.allow) ?? [],
        deny: toStringArray(tools.deny) ?? [],
        sandbox: { enabled: sandboxEnabledFromActual(actual) },
      },
      providers: {},
      env: flattenEnvVars(actual.env),
      cron: {
        enabled: readBoolean(cron?.enabled) ?? true,
        store: readString(cron?.store) ?? "~/.openclaw/cron/jobs.json",
      },
      hooks: {
        enabled: readBoolean(hooks?.enabled) ?? true,
        token: readString(hooks?.token) ?? "",
        path: readString(hooks?.path) ?? "/hooks",
      },
    };
  }

  async applyLegacyPatch(patch: Partial<LegacyOpenClawConfig>): Promise<void> {
    const current = await this.readActualConfig();
    const next = JSON.parse(JSON.stringify(current)) as JsonObject;

    this.applyGatewayPatch(next, patch.gateway);
    this.applyAgentsPatch(next, patch.agents);
    this.applySessionPatch(next, patch.session);
    this.applyChannelsPatch(next, patch.channels);
    this.applyToolsPatch(next, patch.tools);
    this.applyCronPatch(next, patch.cron);
    this.applyHooksPatch(next, patch.hooks);

    await this.writeActualConfig(next);
  }

  private applyGatewayPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["gateway"] | undefined,
  ): void {
    if (!patch) return;
    const gateway = ensureRecord(next, "gateway");
    if (typeof patch.port === "number" && Number.isFinite(patch.port)) gateway.port = patch.port;
    if (typeof patch.bind === "string") gateway.bind = patch.bind;
    if (typeof patch.token === "string") {
      const auth = ensureRecord(gateway, "auth");
      auth.token = patch.token;
      if (typeof auth.mode !== "string") auth.mode = "token";
    }
  }

  private applyAgentsPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["agents"] | undefined,
  ): void {
    const defaultsPatch = patch?.defaults;
    if (!defaultsPatch) return;

    const agents = ensureRecord(next, "agents");
    const defaults = ensureRecord(agents, "defaults");
    if (typeof defaultsPatch.workspace === "string") defaults.workspace = defaultsPatch.workspace;

    const modelPatch = defaultsPatch.model;
    if (modelPatch) {
      const model = ensureRecord(defaults, "model");
      if (typeof modelPatch.primary === "string") model.primary = modelPatch.primary;
      if (Array.isArray(modelPatch.fallbacks)) {
        model.fallbacks = modelPatch.fallbacks.filter((value) => typeof value === "string");
      }
    }

    const sandboxPatch = defaultsPatch.sandbox;
    if (sandboxPatch && typeof sandboxPatch.enabled === "boolean") {
      const sandbox = ensureRecord(defaults, "sandbox");
      if (sandboxPatch.enabled) {
        const currentMode = readString(sandbox.mode);
        sandbox.mode = currentMode && currentMode !== "off" ? currentMode : "non-main";
      } else {
        sandbox.mode = "off";
      }
    }
  }

  private applySessionPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["session"] | undefined,
  ): void {
    if (!patch) return;
    const session = ensureRecord(next, "session");
    const scope = readPolicy(patch.scope, SESSION_SCOPES);
    if (scope) session.scope = scope;
    if (typeof patch.store === "string") session.store = patch.store;

    if (patch.reset) {
      const reset = ensureRecord(session, "reset");
      const mode = readPolicy(patch.reset.mode, SESSION_RESET_MODES);
      if (mode) reset.mode = mode;
      if (typeof patch.reset.idleMinutes === "number" && Number.isFinite(patch.reset.idleMinutes)) {
        reset.idleMinutes = patch.reset.idleMinutes;
      }
    }
  }

  private applyChannelsPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["channels"] | undefined,
  ): void {
    if (!patch) return;
    const channels = ensureRecord(next, "channels");

    for (const [channelId, value] of Object.entries(patch)) {
      const channelPatch = value as LegacyChannelConfig | undefined;
      if (!channelPatch) continue;
      const channel = ensureRecord(channels, channelId);

      if (typeof channelPatch.enabled === "boolean") channel.enabled = channelPatch.enabled;
      if (typeof channelPatch.groupPolicy === "string")
        channel.groupPolicy = channelPatch.groupPolicy;
      if (
        typeof channelPatch.historyLimit === "number" &&
        Number.isFinite(channelPatch.historyLimit)
      ) {
        channel.historyLimit = channelPatch.historyLimit;
      }
      if (typeof channelPatch.mediaMaxMb === "number" && Number.isFinite(channelPatch.mediaMaxMb)) {
        channel.mediaMaxMb = channelPatch.mediaMaxMb;
      }

      if (typeof channelPatch.dmPolicy === "string") {
        if (channelId === "discord" || channelId === "slack") {
          const dm = ensureRecord(channel, "dm");
          dm.policy = channelPatch.dmPolicy;
        } else {
          channel.dmPolicy = channelPatch.dmPolicy;
        }
      }

      if (Array.isArray(channelPatch.allowFrom)) {
        if (channelId === "discord" || channelId === "slack") {
          const dm = ensureRecord(channel, "dm");
          dm.allowFrom = [...channelPatch.allowFrom];
        } else {
          channel.allowFrom = [...channelPatch.allowFrom];
        }
      }

      if (typeof channelPatch.botToken === "string") {
        if (channelId === "discord") {
          channel.token = channelPatch.botToken;
        } else {
          channel.botToken = channelPatch.botToken;
        }
      }

      if (typeof channelPatch.appToken === "string") {
        if (channelId === "slack") {
          channel.appToken = channelPatch.appToken;
        } else if (channelId === "discord") {
          configLog.warn(
            "[config.bridge] ignore channels.discord.appToken (OpenClaw uses channels.discord.token)",
          );
        }
      }

      if (typeof channelPatch.requireMention === "boolean") {
        if (channelId === "telegram" || channelId === "whatsapp") {
          const groups = ensureRecord(channel, "groups");
          const starGroup = ensureRecord(groups, "*");
          starGroup.requireMention = channelPatch.requireMention;
        } else if (channelId === "discord") {
          const guilds = ensureRecord(channel, "guilds");
          const starGuild = ensureRecord(guilds, "*");
          starGuild.requireMention = channelPatch.requireMention;
        } else {
          channel.requireMention = channelPatch.requireMention;
        }
      }
    }
  }

  private applyToolsPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["tools"] | undefined,
  ): void {
    if (!patch) return;
    const tools = ensureRecord(next, "tools");

    if (Array.isArray(patch.allow)) {
      tools.allow = patch.allow.filter((value) => typeof value === "string");
    }
    if (Array.isArray(patch.deny)) {
      tools.deny = patch.deny.filter((value) => typeof value === "string");
    }

    const access = readPolicy(patch.access, TOOL_ACCESS_MODES);
    if (access) {
      const exec = ensureRecord(tools, "exec");
      if (access === "auto") exec.ask = "on-miss";
      if (access === "ask") exec.ask = "always";
      if (access === "deny") {
        exec.ask = "off";
        exec.security = "deny";
      }
    }

    if (typeof patch.sandbox?.enabled === "boolean") {
      const agents = ensureRecord(next, "agents");
      const defaults = ensureRecord(agents, "defaults");
      const sandbox = ensureRecord(defaults, "sandbox");
      if (patch.sandbox.enabled) {
        const currentMode = readString(sandbox.mode);
        sandbox.mode = currentMode && currentMode !== "off" ? currentMode : "non-main";
      } else {
        sandbox.mode = "off";
      }
    }
  }

  private applyCronPatch(next: JsonObject, patch: LegacyOpenClawConfig["cron"] | undefined): void {
    if (!patch) return;
    const cron = ensureRecord(next, "cron");
    if (typeof patch.enabled === "boolean") cron.enabled = patch.enabled;
    if (typeof patch.store === "string") cron.store = patch.store;
  }

  private applyHooksPatch(
    next: JsonObject,
    patch: LegacyOpenClawConfig["hooks"] | undefined,
  ): void {
    if (!patch) return;
    const hooks = ensureRecord(next, "hooks");
    if (typeof patch.enabled === "boolean") hooks.enabled = patch.enabled;
    if (typeof patch.token === "string") hooks.token = patch.token;
    if (typeof patch.path === "string") hooks.path = patch.path;
  }

  private async readActualConfig(): Promise<JsonObject> {
    if (!existsSync(this.configPath)) {
      return {};
    }

    try {
      const raw = await readFile(this.configPath, "utf-8");
      const parsed = JSON5.parse(raw);
      const record = asRecord(parsed);
      return record ?? {};
    } catch (error) {
      configLog.error("[config.bridge.read.failed]", error);
      throw new Error(`Failed to read config at ${this.configPath}`, { cause: error });
    }
  }

  private async writeActualConfig(config: JsonObject): Promise<void> {
    try {
      await mkdir(dirname(this.configPath), { recursive: true });
      const content = JSON.stringify(config, null, 2).concat("\n");
      await writeFile(this.configPath, content, { encoding: "utf-8", mode: 0o600 });
    } catch (error) {
      configLog.error("[config.bridge.write.failed]", error);
      throw error;
    }
  }
}
