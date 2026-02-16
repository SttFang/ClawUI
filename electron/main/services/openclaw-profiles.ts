import { existsSync, lstatSync, readlinkSync } from "fs";
import { mkdir, rm, symlink, unlink } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
import { CONFIG_AGENT_PROFILE_NAME } from "../constants";
import { profilesLog } from "../lib/logger";
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
    // Rescue gateway should not advertise via Bonjour — avoid name conflicts
    configAgentDefaults.discovery = { mdns: { mode: "off" } };

    this.configAgentConfigService = new ConfigService({
      configPath: resolveProfileConfigPath("configAgent"),
      defaultConfig: configAgentDefaults,
    });
  }

  async initialize(): Promise<void> {
    await this.mainConfigService.initialize();
    await this.configAgentConfigService.initialize();
    await this.syncRescueConfig();
    await this.ensureSharedAgents();
  }

  /**
   * Sync model and tools from the main config into the rescue config so
   * the rescue gateway uses credentials that actually exist.
   */
  private async syncRescueConfig(): Promise<void> {
    const mainConfig = await this.mainConfigService.getConfig();
    const rescueConfig = await this.configAgentConfigService.getConfig();
    const patch: Partial<OpenClawConfig> = {};

    // Sync model from main so rescue uses credentials that actually exist
    const model = mainConfig?.agents?.defaults?.model;
    if (model?.primary) {
      const current = rescueConfig?.agents?.defaults?.model;
      if (
        current?.primary !== model.primary ||
        JSON.stringify(current?.fallbacks) !== JSON.stringify(model.fallbacks)
      ) {
        patch.agents = { defaults: { model } };
        profilesLog.info("[profiles.sync-model]", `primary=${model.primary}`);
      }
    }

    // Ensure tools match ClawUI expectations (onboard may overwrite them)
    const expectedTools = { allow: ["group:fs", "group:runtime", "exec"], deny: ["web_*"] };
    const currentTools = rescueConfig?.tools;
    if (
      JSON.stringify(currentTools?.allow) !== JSON.stringify(expectedTools.allow) ||
      JSON.stringify(currentTools?.deny) !== JSON.stringify(expectedTools.deny)
    ) {
      patch.tools = expectedTools;
      profilesLog.info("[profiles.sync-tools]");
    }

    // Rescue gateway must not advertise via Bonjour to avoid name conflicts
    if (rescueConfig?.discovery?.mdns?.mode !== "off") {
      patch.discovery = { mdns: { mode: "off" } };
      profilesLog.info("[profiles.sync-discovery]", "mdns=off");
    }

    if (Object.keys(patch).length > 0) {
      await this.configAgentConfigService.setConfig(patch);
    }
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

    if (!existsSync(mainAgentDir)) return;

    // Use lstat to detect broken symlinks (existsSync returns false for them)
    let stat: ReturnType<typeof lstatSync> | null = null;
    try {
      stat = lstatSync(rescueAgentDir);
    } catch (err) {
      profilesLog.debug("[profiles.symlink.stat.ignored]", err);
    }

    if (stat?.isSymbolicLink()) {
      try {
        const target = readlinkSync(rescueAgentDir);
        if (target === mainAgentDir) return; // correct symlink — done
      } catch (err) {
        profilesLog.debug("[profiles.symlink.read.ignored]", err);
      }
      await unlink(rescueAgentDir); // stale/broken — remove
    } else if (stat) {
      await rm(rescueAgentDir, { recursive: true }); // unexpected real dir — remove
    }

    await mkdir(dirname(rescueAgentDir), { recursive: true });
    try {
      await symlink(mainAgentDir, rescueAgentDir, "dir");
      profilesLog.info("[profiles.symlink]", `${rescueAgentDir} -> ${mainAgentDir}`);
    } catch (err) {
      if (
        process.platform === "win32" &&
        ["EPERM", "ENOTSUP"].includes((err as NodeJS.ErrnoException).code ?? "")
      ) {
        await symlink(mainAgentDir, rescueAgentDir, "junction");
      } else {
        profilesLog.error("[profiles.symlink.failed]", err);
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
