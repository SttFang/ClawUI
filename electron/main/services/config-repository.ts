import type { OnboardingOpenClawConfig } from "@clawui/types/config";
import type { BYOKConfig, SubscriptionConfig } from "@clawui/types/onboarding";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import JSON5 from "json5";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { configLog } from "../lib/logger";
import { isRecord } from "../utils/type-guards";
import { ConfigService, type OpenClawConfig } from "./config";

const ENV_ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";
const ENV_OPENAI_API_KEY = "OPENAI_API_KEY";
const ENV_PROXY_URL = "OPENCLAW_PROXY_URL";
const ENV_PROXY_TOKEN = "OPENCLAW_PROXY_TOKEN";

type JsonObject = Record<string, unknown>;

function inferSchemaVersion(raw: JsonObject): string {
  if (isRecord(raw.gateway) && isRecord((raw.gateway as JsonObject).auth)) {
    return "canonical-v2";
  }
  if (isRecord(raw.models) || isRecord(raw.proxy) || isRecord(raw.server)) {
    return "legacy-v1";
  }
  return "unknown";
}

export type ConfigInspectResult = {
  exists: boolean;
  valid: boolean;
  schemaVersion: string | null;
  config: OpenClawConfig | null;
};

export class ConfigRepository {
  constructor(private readonly configService: ConfigService) {}

  getPath(): string {
    return this.configService.getConfigPath();
  }

  async inspectCanonicalConfig(): Promise<ConfigInspectResult> {
    const configPath = this.configService.getConfigPath();
    if (!existsSync(configPath)) {
      return { exists: false, valid: false, schemaVersion: null, config: null };
    }

    try {
      // Read raw file for schema version detection
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON5.parse(content);
      if (!isRecord(parsed)) {
        return { exists: true, valid: false, schemaVersion: "invalid", config: null };
      }
      // Delegate config loading to ConfigService
      const config = await this.configService.getConfig();
      return {
        exists: true,
        valid: true,
        schemaVersion: inferSchemaVersion(parsed),
        config,
      };
    } catch (error) {
      configLog.warn("[config.repository.inspect.failed]", error);
      return { exists: true, valid: false, schemaVersion: "invalid", config: null };
    }
  }

  async patchCanonicalConfig(partial: Partial<OpenClawConfig>): Promise<OpenClawConfig> {
    await this.configService.setConfig(partial);
    return (await this.configService.getConfig())!;
  }

  async patchCanonicalEnv(
    patch: Record<string, string | null | undefined>,
  ): Promise<OpenClawConfig> {
    await this.configService.patchEnv(patch);
    return (await this.configService.getConfig())!;
  }

  async configureSubscription(config: SubscriptionConfig): Promise<void> {
    await this.patchCanonicalEnv({
      [ENV_PROXY_URL]: config.proxyUrl,
      [ENV_PROXY_TOKEN]: config.proxyToken,
    });
  }

  async configureBYOK(keys: BYOKConfig): Promise<void> {
    await this.patchCanonicalEnv({
      [ENV_ANTHROPIC_API_KEY]: keys.anthropic ?? null,
      [ENV_OPENAI_API_KEY]: keys.openai ?? null,
    });
  }

  async readOnboardingConfig(): Promise<OnboardingOpenClawConfig | null> {
    const config = await this.configService.getConfig();
    if (!config) return null;

    const env = config.env ?? {};

    const onboardingConfig: OnboardingOpenClawConfig = {
      server: {
        port: config.gateway?.port ?? DEFAULT_GATEWAY_PORT,
        host:
          config.gateway?.bind === "loopback" ? "127.0.0.1" : (config.gateway?.bind ?? "127.0.0.1"),
      },
    };

    const anthropicKey = env[ENV_ANTHROPIC_API_KEY];
    const openaiKey = env[ENV_OPENAI_API_KEY];
    if (anthropicKey || openaiKey) {
      onboardingConfig.models = {};
      if (anthropicKey) {
        onboardingConfig.models.anthropic = {
          apiKey: anthropicKey,
          models: ["claude-sonnet-4-5", "claude-opus-4", "claude-3-5-sonnet", "claude-3-haiku"],
        };
      }
      if (openaiKey) {
        onboardingConfig.models.openai = {
          apiKey: openaiKey,
          models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"],
        };
      }
    }

    const proxyUrl = env[ENV_PROXY_URL];
    const proxyToken = env[ENV_PROXY_TOKEN];
    if (proxyUrl) {
      onboardingConfig.proxy = {
        url: proxyUrl,
        token: proxyToken,
      };
    }

    return onboardingConfig;
  }

  async updateOnboardingConfig(updates: Partial<OnboardingOpenClawConfig>): Promise<void> {
    const patch: Record<string, string | null | undefined> = {};

    if (updates.models) {
      patch[ENV_ANTHROPIC_API_KEY] = updates.models.anthropic?.apiKey ?? null;
      patch[ENV_OPENAI_API_KEY] = updates.models.openai?.apiKey ?? null;
    }
    if (updates.proxy) {
      patch[ENV_PROXY_URL] = updates.proxy.url ?? null;
      patch[ENV_PROXY_TOKEN] = updates.proxy.token ?? null;
    }

    if (Object.keys(patch).length > 0) {
      await this.patchCanonicalEnv(patch);
    }

    if (updates.server?.port || updates.server?.host) {
      const nextGateway: Partial<NonNullable<OpenClawConfig["gateway"]>> = {};
      if (typeof updates.server.port === "number") {
        nextGateway.port = updates.server.port;
      }
      if (typeof updates.server.host === "string" && updates.server.host.trim()) {
        nextGateway.bind = updates.server.host.trim();
      }
      await this.patchCanonicalConfig({ gateway: nextGateway as OpenClawConfig["gateway"] });
    }
  }
}
