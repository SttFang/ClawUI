import type {
  CredentialMeta,
  LlmCredentialMeta,
  ChannelCredentialMeta,
  ProxyCredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
} from "@clawui/types/credentials";
import { safeStorage } from "electron";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
import { configLog } from "../lib/logger";
import { AuthProfileAdapter } from "./auth-profile-adapter";
import type { ConfigService } from "./config";

const ENV_ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";
const ENV_OPENAI_API_KEY = "OPENAI_API_KEY";
const ENV_PROXY_URL = "OPENCLAW_PROXY_URL";
const ENV_PROXY_TOKEN = "OPENCLAW_PROXY_TOKEN";

const CHANNEL_TOKEN_ENV_MAP: Record<string, Record<string, string>> = {
  discord: { botToken: "DISCORD_BOT_TOKEN", appToken: "DISCORD_APP_TOKEN" },
  telegram: { botToken: "TELEGRAM_BOT_TOKEN" },
  slack: { botToken: "SLACK_BOT_TOKEN", appToken: "SLACK_APP_TOKEN" },
};

const LLM_PROVIDERS = ["anthropic", "openai"] as const;
const CHANNEL_TYPES = ["discord", "telegram", "slack"] as const;

function maskSecret(value: string): string {
  if (value.length <= 8) return "***";
  const prefix = value.slice(0, 7);
  const suffix = value.slice(-3);
  return `${prefix}***...${suffix}`;
}

function profileIdForProvider(provider: string): string {
  return `${provider}:default`;
}

export class CredentialService {
  private readonly authProfiles: AuthProfileAdapter;
  private readonly encCachePath: string;
  private encCache: Record<string, Buffer> = {};

  constructor(
    private readonly configService: ConfigService,
  ) {
    const openclawDir = dirname(configService.getConfigPath());
    this.authProfiles = new AuthProfileAdapter(join(openclawDir, "agents"));
    this.encCachePath = join(homedir(), ".clawui", "credentials.enc");
  }

  async initialize(): Promise<void> {
    const t0 = Date.now();
    await this.loadEncCache();
    await this.migrateLegacyKeys();
    configLog.info("[credential.init]", `durationMs=${Date.now() - t0}`);
  }

  async getAllCredentials(): Promise<CredentialMeta[]> {
    const results: CredentialMeta[] = [];

    // LLM credentials
    for (const provider of LLM_PROVIDERS) {
      const profileId = profileIdForProvider(provider);
      const profile = await this.authProfiles.getProfile(profileId);
      const hasKey = Boolean(profile?.key);
      results.push({
        category: "llm",
        provider,
        profileId,
        mode: "api_key",
        maskedKey: hasKey ? maskSecret(profile!.key!) : "",
        hasKey,
      } satisfies LlmCredentialMeta);
    }

    // Channel credentials
    const config = await this.configService.getConfig();
    const env = config?.env ?? {};
    for (const channelType of CHANNEL_TYPES) {
      const envMap = CHANNEL_TOKEN_ENV_MAP[channelType];
      if (!envMap) continue;
      for (const [tokenField, envKey] of Object.entries(envMap)) {
        const value = env[envKey] ?? "";
        results.push({
          category: "channel",
          channelType,
          tokenField,
          maskedValue: value ? maskSecret(value) : "",
          hasValue: Boolean(value),
        } satisfies ChannelCredentialMeta);
      }
    }

    // Proxy credentials
    const proxyUrl = env[ENV_PROXY_URL] ?? "";
    const proxyToken = env[ENV_PROXY_TOKEN] ?? "";
    results.push(
      {
        category: "proxy",
        key: ENV_PROXY_URL,
        maskedValue: proxyUrl ? maskSecret(proxyUrl) : "",
        hasValue: Boolean(proxyUrl),
      } satisfies ProxyCredentialMeta,
      {
        category: "proxy",
        key: ENV_PROXY_TOKEN,
        maskedValue: proxyToken ? maskSecret(proxyToken) : "",
        hasValue: Boolean(proxyToken),
      } satisfies ProxyCredentialMeta,
    );

    return results;
  }

  async setLlmKey(input: SetLlmKeyInput): Promise<void> {
    const profileId = profileIdForProvider(input.provider);
    await this.authProfiles.setProfile(profileId, {
      type: "api_key",
      provider: input.provider,
      key: input.apiKey,
    });
    await this.encCacheSet(`llm:${input.provider}`, input.apiKey);

    // Remove legacy env key if present
    const envKey = input.provider === "anthropic" ? ENV_ANTHROPIC_API_KEY : ENV_OPENAI_API_KEY;
    const config = await this.configService.getConfig();
    if (config?.env?.[envKey]) {
      await this.configService.patchEnv({ [envKey]: null });
      configLog.info("[credential.legacy.cleaned]", `envKey=${envKey}`);
    }
  }

  async setChannelToken(input: SetChannelTokenInput): Promise<void> {
    const envMap = CHANNEL_TOKEN_ENV_MAP[input.channelType];
    if (!envMap) throw new Error(`Unknown channel type: ${input.channelType}`);
    const envKey = envMap[input.tokenField];
    if (!envKey) throw new Error(`Unknown token field: ${input.tokenField}`);

    await this.configService.patchEnv({
      [envKey]: input.value || null,
    });
    if (input.value) {
      await this.encCacheSet(`channel:${input.channelType}:${input.tokenField}`, input.value);
    }
  }

  async setProxy(input: SetProxyInput): Promise<void> {
    await this.configService.patchEnv({
      [ENV_PROXY_URL]: input.proxyUrl || null,
      [ENV_PROXY_TOKEN]: input.proxyToken || null,
    });
    if (input.proxyUrl) {
      await this.encCacheSet("proxy:url", input.proxyUrl);
    }
    if (input.proxyToken) {
      await this.encCacheSet("proxy:token", input.proxyToken);
    }
  }

  async deleteCredential(input: DeleteCredentialInput): Promise<void> {
    if (input.category === "llm") {
      const deleted = await this.authProfiles.deleteProfile(input.id);
      if (!deleted) {
        configLog.warn("[credential.delete.not-found]", `id=${input.id}`);
      }
    } else if (input.category === "channel") {
      // id format: "discord:botToken"
      const [channelType, tokenField] = input.id.split(":");
      if (channelType && tokenField) {
        await this.setChannelToken({ channelType, tokenField: tokenField as "botToken" | "appToken", value: "" });
      }
    } else if (input.category === "proxy") {
      await this.configService.patchEnv({
        [input.id]: null,
      });
    }
  }

  validateLlmKey(provider: string, key: string): ValidateKeyResult {
    if (provider === "anthropic") {
      return { valid: key.startsWith("sk-ant-") };
    }
    if (provider === "openai") {
      return { valid: key.startsWith("sk-") };
    }
    return { valid: false, error: `Unknown provider: ${provider}` };
  }

  // --- Legacy migration (Step 1.4) ---

  private async migrateLegacyKeys(): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config?.env) return;

    const migrations: Array<{ envKey: string; provider: string }> = [
      { envKey: ENV_ANTHROPIC_API_KEY, provider: "anthropic" },
      { envKey: ENV_OPENAI_API_KEY, provider: "openai" },
    ];

    for (const { envKey, provider } of migrations) {
      const envValue = config.env[envKey];
      if (!envValue) continue;

      const profileId = profileIdForProvider(provider);
      const existing = await this.authProfiles.getProfile(profileId);
      if (existing?.key) continue; // auth-profiles already has a key

      await this.authProfiles.setProfile(profileId, {
        type: "api_key",
        provider,
        key: envValue,
      });
      await this.configService.patchEnv({ [envKey]: null });
      configLog.info(
        "[credential.migrate]",
        `provider=${provider} envKey=${envKey} → auth-profiles`,
      );
    }
  }

  // --- Encrypted cache helpers ---

  private async loadEncCache(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    if (!existsSync(this.encCachePath)) return;
    try {
      const raw = await readFile(this.encCachePath);
      const parsed: unknown = JSON.parse(raw.toString("utf-8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "string") {
            this.encCache[key] = Buffer.from(value, "base64");
          }
        }
      }
    } catch {
      configLog.debug("[credential.enc-cache.load.skipped]");
    }
  }

  private async encCacheSet(key: string, plaintext: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    this.encCache[key] = safeStorage.encryptString(plaintext);
    await this.saveEncCache();
  }

  private async saveEncCache(): Promise<void> {
    const dir = dirname(this.encCachePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const serialized: Record<string, string> = {};
    for (const [key, buf] of Object.entries(this.encCache)) {
      serialized[key] = buf.toString("base64");
    }
    await writeFile(this.encCachePath, JSON.stringify(serialized, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}
