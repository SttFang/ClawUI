import { homedir } from "os";
import { join } from "path";
import { ConfigService, createDefaultConfig, type OpenClawConfig } from "./config";

export type OpenClawProfileId = "main" | "configAgent";

const CONFIG_AGENT_PROFILE_NAME = "clawui-config-agent";

function resolveProfileConfigPath(profileId: OpenClawProfileId): string {
  if (profileId === "main") return join(homedir(), ".openclaw", "openclaw.json");
  // `openclaw --profile <name>` isolates config/state under `~/.openclaw-<name>`.
  return join(homedir(), `.openclaw-${CONFIG_AGENT_PROFILE_NAME}`, "openclaw.json");
}

export class OpenClawProfilesService {
  private readonly mainConfigService: ConfigService;
  private readonly configAgentConfigService: ConfigService;

  constructor() {
    this.mainConfigService = new ConfigService({
      configPath: resolveProfileConfigPath("main"),
      defaultConfig: createDefaultConfig(18789),
    });

    const configAgentDefaults: OpenClawConfig = createDefaultConfig(19789);
    // Min-permission defaults: this profile is meant to generate patches/metadata,
    // not to execute local tools. Any "elevated" changes are applied by ClawUI with
    // strict allowlists, not by this agent directly.
    configAgentDefaults.tools = {
      allow: [],
      deny: ["exec", "group:fs", "web_*"],
    };

    this.configAgentConfigService = new ConfigService({
      configPath: resolveProfileConfigPath("configAgent"),
      defaultConfig: configAgentDefaults,
    });
  }

  async initialize(): Promise<void> {
    await this.mainConfigService.initialize();
    await this.configAgentConfigService.initialize();
  }

  getConfigPath(profileId: OpenClawProfileId): string {
    return resolveProfileConfigPath(profileId);
  }

  getConfigService(profileId: OpenClawProfileId): ConfigService {
    return profileId === "main" ? this.mainConfigService : this.configAgentConfigService;
  }

  async getConfig(profileId: OpenClawProfileId): Promise<OpenClawConfig | null> {
    return this.getConfigService(profileId).getConfig();
  }

  async setConfig(profileId: OpenClawProfileId, partial: Partial<OpenClawConfig>): Promise<void> {
    return this.getConfigService(profileId).setConfig(partial);
  }

  async patchEnvBoth(patch: Record<string, string | null | undefined>): Promise<void> {
    await this.mainConfigService.patchEnv(patch);
    await this.configAgentConfigService.patchEnv(patch);
  }
}
