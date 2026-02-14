import type { OnboardingOpenClawConfig } from "@clawui/types/config";
import type { BYOKConfig, SubscriptionConfig } from "@clawui/types/onboarding";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import JSON5 from "json5";
import { homedir } from "os";
import { dirname, join } from "path";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { configLog } from "../lib/logger";
import { createDefaultConfig, type OpenClawConfig } from "./config";

const ENV_ANTHROPIC_API_KEY = "ANTHROPIC_API_KEY";
const ENV_OPENAI_API_KEY = "OPENAI_API_KEY";
const ENV_PROXY_URL = "OPENCLAW_PROXY_URL";
const ENV_PROXY_TOKEN = "OPENCLAW_PROXY_TOKEN";

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (result as Record<string, unknown>)[key];
    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Partial<Record<string, unknown>>,
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }
  return result;
}

function inferSchemaVersion(raw: JsonObject): string {
  if (isRecord(raw.gateway) && isRecord((raw.gateway as JsonObject).auth)) {
    return "canonical-v2";
  }
  if (isRecord(raw.models) || isRecord(raw.proxy) || isRecord(raw.server)) {
    return "legacy-v1";
  }
  return "unknown";
}

function normalizeCanonical(raw: JsonObject): OpenClawConfig {
  const base = createDefaultConfig(DEFAULT_GATEWAY_PORT);
  const merged = deepMerge(base, raw as Partial<OpenClawConfig>);
  if (!merged.gateway?.auth?.token) {
    const gateway = (merged.gateway ??= {});
    const auth = (gateway.auth ??= {});
    auth.token = randomBytes(24).toString("base64url");
  }
  return merged;
}

export type ConfigInspectResult = {
  exists: boolean;
  valid: boolean;
  schemaVersion: string | null;
  config: OpenClawConfig | null;
};

export class ConfigRepository {
  private readonly configPath: string;

  constructor(configPath = join(homedir(), ".openclaw", "openclaw.json")) {
    this.configPath = configPath;
  }

  getPath(): string {
    return this.configPath;
  }

  async inspectCanonicalConfig(): Promise<ConfigInspectResult> {
    if (!existsSync(this.configPath)) {
      return {
        exists: false,
        valid: false,
        schemaVersion: null,
        config: null,
      };
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON5.parse(content);
      if (!isRecord(parsed)) {
        return {
          exists: true,
          valid: false,
          schemaVersion: "invalid",
          config: null,
        };
      }
      return {
        exists: true,
        valid: true,
        schemaVersion: inferSchemaVersion(parsed),
        config: normalizeCanonical(parsed),
      };
    } catch (error) {
      configLog.warn("[config.repository.inspect.failed]", error);
      return {
        exists: true,
        valid: false,
        schemaVersion: "invalid",
        config: null,
      };
    }
  }

  async patchCanonicalConfig(partial: Partial<OpenClawConfig>): Promise<OpenClawConfig> {
    const inspected = await this.inspectCanonicalConfig();
    const current = inspected.config ?? createDefaultConfig(DEFAULT_GATEWAY_PORT);
    const next = deepMerge(current, partial);
    await this.writeCanonicalConfig(next);
    return next;
  }

  async patchCanonicalEnv(
    patch: Record<string, string | null | undefined>,
  ): Promise<OpenClawConfig> {
    const inspected = await this.inspectCanonicalConfig();
    const current = inspected.config ?? createDefaultConfig(DEFAULT_GATEWAY_PORT);
    const nextEnv = { ...(current.env ?? {}) };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null) {
        delete nextEnv[key];
      } else {
        nextEnv[key] = value;
      }
    }
    return this.patchCanonicalConfig({ env: nextEnv });
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
    const inspected = await this.inspectCanonicalConfig();
    if (!inspected.exists || !inspected.config) return null;

    const config = inspected.config;
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
      const nextGateway: Partial<OpenClawConfig["gateway"]> = {};
      if (typeof updates.server.port === "number") {
        nextGateway.port = updates.server.port;
      }
      if (typeof updates.server.host === "string" && updates.server.host.trim()) {
        nextGateway.bind = updates.server.host.trim();
      }
      await this.patchCanonicalConfig({ gateway: nextGateway as OpenClawConfig["gateway"] });
    }
  }

  private async writeCanonicalConfig(config: OpenClawConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }
}
