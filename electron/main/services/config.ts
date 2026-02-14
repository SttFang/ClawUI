import type { CanonicalOpenClawConfig } from "@clawui/types/config-canonical";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import JSON5 from "json5";
import { homedir } from "os";
import { join, dirname } from "path";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { configLog } from "../lib/logger";

export type OpenClawConfig = CanonicalOpenClawConfig;

export function createDefaultConfig(port: number): OpenClawConfig {
  return {
    gateway: {
      mode: "local",
      port,
      bind: "loopback",
      auth: {
        mode: "token",
        token: "",
      },
    },
    agents: {
      defaults: {
        workspace: "~/.openclaw/workspace",
      },
    },
    session: {
      scope: "per-sender",
      store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
      reset: {
        mode: "idle",
        idleMinutes: 60,
      },
    },
    channels: {},
    tools: {
      allow: ["group:fs", "group:runtime"],
      deny: [],
    },
    env: {},
    cron: {
      enabled: true,
      store: "~/.openclaw/cron/jobs.json",
    },
    hooks: {
      enabled: true,
      token: randomBytes(16).toString("base64url"),
      path: "/hooks",
    },
  };
}

export class ConfigService {
  private configPath: string;
  private config: OpenClawConfig | null = null;
  private defaultConfig: OpenClawConfig;

  constructor(options?: { configPath?: string; defaultConfig?: OpenClawConfig }) {
    this.configPath = options?.configPath ?? join(homedir(), ".openclaw", "openclaw.json");
    this.defaultConfig = options?.defaultConfig ?? createDefaultConfig(DEFAULT_GATEWAY_PORT);
  }

  async initialize(): Promise<void> {
    const t0 = Date.now();
    // Ensure .openclaw directory exists
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }

    // Load or create config
    if (existsSync(this.configPath)) {
      await this.loadConfig();
      // If the config exists but is missing the gateway token, set one.
      if (this.config && !this.config.gateway?.auth?.token) {
        const gateway = (this.config.gateway ??= {});
        const auth = (gateway.auth ??= {});
        auth.token = this.generateToken();
        await this.saveConfig();
      }
    } else {
      this.config = { ...this.defaultConfig };
      // Generate a random token if not set
      const gateway = (this.config.gateway ??= {});
      const auth = (gateway.auth ??= {});
      auth.token = this.generateToken();
      await this.saveConfig();
      configLog.info("[config.created]", this.configPath);
    }
    configLog.info("[config.init]", `durationMs=${Date.now() - t0}`);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async getConfig(): Promise<OpenClawConfig | null> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config;
  }

  async setConfig(partial: Partial<OpenClawConfig>): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    // Deep merge the partial config
    this.config = this.deepMerge(this.config || this.defaultConfig, partial);
    await this.saveConfig();
  }

  async patchEnv(patch: Record<string, string | null | undefined>): Promise<void> {
    const cfg = (await this.getConfig()) ?? { ...this.defaultConfig };
    const currentEnv = { ...(cfg.env || {}) } as Record<string, string>;

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null) {
        delete currentEnv[key];
      } else {
        currentEnv[key] = value;
      }
    }

    await this.setConfig({ env: currentEnv });
  }

  private async loadConfig(): Promise<void> {
    try {
      const content = await readFile(this.configPath, "utf-8");
      this.config = JSON5.parse(content) as OpenClawConfig;
    } catch (error) {
      configLog.error("[config.load.failed]", error);
      this.config = { ...this.defaultConfig };
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const content = JSON.stringify(this.config, null, 2);
      await writeFile(this.configPath, content, "utf-8");
    } catch (error) {
      configLog.error("[config.save.failed]", error);
      throw error;
    }
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
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
        (result as Record<string, unknown>)[key] = this.deepMerge(
          targetValue,
          sourceValue as Partial<typeof targetValue>,
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }

    return result;
  }

  private generateToken(): string {
    return randomBytes(24).toString("base64url");
  }
}
