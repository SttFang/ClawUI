import type {
  CredentialMeta,
  LlmCredentialMeta,
  ChannelCredentialMeta,
  ProxyCredentialMeta,
  ToolCredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetToolKeyInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
} from "@clawui/types/credentials";
import { safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { configLog } from "../lib/logger";
import { AuthProfileAdapter } from "./auth-profile-adapter";
import { ConfigService, getNestedValue } from "./config";
import {
  CHANNEL_TOKEN_DEFS,
  ENV_ANTHROPIC_API_KEY,
  ENV_OPENAI_API_KEY,
  ENV_PROXY_TOKEN,
  ENV_PROXY_URL,
  KEY_PREFIX_MAP,
  LEGACY_CHANNEL_ENV_MAP,
  LEGACY_LLM_ENV_MAP,
} from "./credential-defs";
import {
  credentialHasValue,
  credentialMode,
  credentialSecret,
  maskSecret,
  profileIdForProvider,
} from "./credential-helpers";
import { syncExternalCliCredentials } from "./external-cli-sync";
import { TOOL_CREDENTIAL_DEFS } from "./tool-credential-registry";

export type { ChannelTokenDef, ChannelTokenFieldDef } from "./credential-defs";
export { CHANNEL_TOKEN_DEFS } from "./credential-defs";

export class CredentialService {
  private readonly authProfiles: AuthProfileAdapter;
  private readonly encCachePath: string;
  private encCache: Record<string, Buffer> = {};

  constructor(private readonly configService: ConfigService) {
    const openclawDir = dirname(configService.getConfigPath());
    this.authProfiles = new AuthProfileAdapter(join(openclawDir, "agents"));
    this.encCachePath = join(homedir(), ".clawui", "credentials.enc");
  }

  getAuthProfileAdapter(): AuthProfileAdapter {
    return this.authProfiles;
  }

  async initialize(): Promise<void> {
    const t0 = Date.now();
    await this.loadEncCache();
    await this.migrateLegacyKeys();
    await syncExternalCliCredentials(this.authProfiles);
    configLog.info("[credential.init]", `durationMs=${Date.now() - t0}`);
  }

  async getAllCredentials(): Promise<CredentialMeta[]> {
    const results: CredentialMeta[] = [];

    // LLM credentials — dynamic discovery from auth-profiles
    const store = await this.authProfiles.read();
    for (const [profileId, cred] of Object.entries(store.profiles)) {
      const hasKey = credentialHasValue(cred);
      results.push({
        category: "llm",
        provider: cred.provider,
        profileId,
        mode: credentialMode(cred),
        maskedKey: hasKey ? maskSecret(credentialSecret(cred)) : "",
        hasKey,
        expires: "expires" in cred ? cred.expires : undefined,
        email: cred.email,
      } satisfies LlmCredentialMeta);
    }

    // Channel credentials — from config paths
    const config = await this.configService.getConfig();
    for (const def of CHANNEL_TOKEN_DEFS) {
      for (const fieldDef of def.fields) {
        const value = getNestedValue(config, fieldDef.configPath);
        const strValue = typeof value === "string" ? value : "";
        results.push({
          category: "channel",
          channelType: def.channelType,
          tokenField: fieldDef.field,
          maskedValue: strValue ? maskSecret(strValue) : "",
          hasValue: Boolean(strValue),
        } satisfies ChannelCredentialMeta);
      }
    }

    // Proxy credentials
    const env = config?.env ?? {};
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

    // Tool credentials
    for (const def of TOOL_CREDENTIAL_DEFS) {
      const configValue = getNestedValue(config, def.configPath);
      const envValue = def.envFallback ? (env[def.envFallback] ?? "") : "";
      const value = (typeof configValue === "string" ? configValue : "") || envValue;
      results.push({
        category: "tool",
        toolId: def.toolId,
        configPath: def.configPath,
        label: def.label,
        maskedValue: value ? maskSecret(value) : "",
        hasValue: Boolean(value),
      } satisfies ToolCredentialMeta);
    }

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
    const legacyEnvKey = LEGACY_LLM_ENV_MAP[input.provider];
    if (legacyEnvKey) {
      const config = await this.configService.getConfig();
      if (config?.env?.[legacyEnvKey]) {
        await this.configService.patchEnv({ [legacyEnvKey]: null });
        configLog.info("[credential.legacy.cleaned]", `envKey=${legacyEnvKey}`);
      }
    }
  }

  async setChannelToken(input: SetChannelTokenInput): Promise<void> {
    const def = CHANNEL_TOKEN_DEFS.find((d) => d.channelType === input.channelType);
    if (!def) throw new Error(`Unknown channel type: ${input.channelType}`);
    const fieldDef = def.fields.find((f) => f.field === input.tokenField);
    if (!fieldDef) throw new Error(`Unknown token field: ${input.tokenField}`);

    await this.configService.patchPath(fieldDef.configPath, input.value || null);
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

  async setToolApiKey(input: SetToolKeyInput): Promise<void> {
    const def = TOOL_CREDENTIAL_DEFS.find((d) => d.toolId === input.toolId);
    if (!def) throw new Error(`Unknown tool: ${input.toolId}`);
    await this.configService.patchPath(def.configPath, input.value || null);
    if (input.value) {
      await this.encCacheSet(`tool:${input.toolId}`, input.value);
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
        await this.setChannelToken({ channelType, tokenField, value: "" });
      }
    } else if (input.category === "proxy") {
      await this.configService.patchEnv({ [input.id]: null });
    } else if (input.category === "tool") {
      await this.setToolApiKey({ toolId: input.id, value: "" });
    }
  }

  validateLlmKey(provider: string, key: string): ValidateKeyResult {
    const prefixes = KEY_PREFIX_MAP[provider];
    if (!prefixes) return { valid: true }; // unknown provider — don't block
    const valid = prefixes.some((p) => key.startsWith(p));
    return valid ? { valid: true } : { valid: false, error: `Invalid key prefix for ${provider}` };
  }

  // --- Legacy migration ---

  private async migrateLegacyKeys(): Promise<void> {
    const config = await this.configService.getConfig();
    if (!config?.env) return;

    // LLM keys: env → auth-profiles
    const llmMigrations: Array<{ envKey: string; provider: string }> = [
      { envKey: ENV_ANTHROPIC_API_KEY, provider: "anthropic" },
      { envKey: ENV_OPENAI_API_KEY, provider: "openai" },
    ];

    for (const { envKey, provider } of llmMigrations) {
      const envValue = config.env[envKey];
      if (!envValue) continue;

      const profileId = profileIdForProvider(provider);
      const existing = await this.authProfiles.getProfile(profileId);
      if (existing && credentialHasValue(existing)) continue;

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

    // Channel tokens: env → config paths
    for (const { envKey, configPath } of LEGACY_CHANNEL_ENV_MAP) {
      const envValue = config.env[envKey];
      if (!envValue) continue;

      const existing = getNestedValue(config, configPath);
      if (existing) continue;

      await this.configService.patchPath(configPath, envValue);
      await this.configService.patchEnv({ [envKey]: null });
      configLog.info("[credential.migrate]", `envKey=${envKey} → ${configPath}`);
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
