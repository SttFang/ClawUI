import { existsSync } from "fs";
import { mkdir, symlink } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
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
    await this.ensureSharedAgents();
  }

  /**
   * Symlink the rescue gateway's agent credential dir to the main one so
   * auth-profiles (LLM API keys) are shared without duplication.
   *
   * We symlink at `agents/main/agent` (not the whole `agents` dir) because
   * the rescue profile keeps its own `agents/main/sessions`.
   */
  private async ensureSharedAgents(): Promise<void> {
    const mainAgentDir = join(homedir(), ".openclaw", "agents", "main", "agent");
    const rescueAgentDir = join(
      homedir(),
      `.openclaw-${CONFIG_AGENT_PROFILE_NAME}`,
      "agents",
      "main",
      "agent",
    );
    // Already exists (real dir or symlink) — skip
    if (existsSync(rescueAgentDir)) return;
    // Main dir doesn't exist yet (no credentials configured) — skip
    if (!existsSync(mainAgentDir)) return;

    await mkdir(dirname(rescueAgentDir), { recursive: true });
    try {
      await symlink(mainAgentDir, rescueAgentDir, "dir");
    } catch (err) {
      // Windows without developer mode: fall back to junction
      if (
        process.platform === "win32" &&
        ((err as NodeJS.ErrnoException).code === "EPERM" ||
          (err as NodeJS.ErrnoException).code === "ENOTSUP")
      ) {
        await symlink(mainAgentDir, rescueAgentDir, "junction");
      } else {
        throw err;
      }
    }
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
