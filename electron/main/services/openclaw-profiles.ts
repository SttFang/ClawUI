import { homedir } from "os";
import { join } from "path";
import { CONFIG_AGENT_PROFILE_NAME } from "../constants";
import { ConfigService, createDefaultConfig, type OpenClawConfig } from "./config";

export type OpenClawProfileId = "main" | "configAgent";

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
    // Rescue agent needs fs + runtime + exec to manage the main gateway configuration.
    // Only web tools are denied to limit attack surface.
    configAgentDefaults.tools = {
      allow: ["group:fs", "group:runtime", "exec"],
      deny: ["web_*"],
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
