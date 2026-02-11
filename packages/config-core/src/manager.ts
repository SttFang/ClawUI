import type {
  ConfigCoreOptions,
  ConfigDraftStoreLike,
  ConfigObject,
  ConfigPath,
  ConfigPathPatch,
} from "./types";
import { createEnvPathPatches, readConfigEnvVars } from "./env";
import { getConfigPathValue, normalizeConfigPath } from "./path";
import { applyConfigPatch, applyConfigPathPatch, applyConfigPathPatches } from "./transaction";

function readCurrentConfig(store: ConfigDraftStoreLike): ConfigObject {
  const state = store.getState();
  if (state.draft) return state.draft;
  return state.snapshot?.config ?? {};
}

export class ConfigCoreManager {
  private readonly options: ConfigCoreOptions;

  constructor(
    private readonly store: ConfigDraftStoreLike,
    options: ConfigCoreOptions = {},
  ) {
    this.options = options;
  }

  async loadSnapshot(force = false): Promise<void> {
    await this.store.getState().loadSnapshot(force);
  }

  getConfig(): ConfigObject {
    return readCurrentConfig(this.store);
  }

  getPath(path: string | ConfigPath): unknown {
    return getConfigPathValue(this.getConfig(), path);
  }

  getEnv(): Record<string, string> {
    return readConfigEnvVars(this.getConfig());
  }

  getEnvValue(key: string): string {
    return this.getEnv()[key] ?? "";
  }

  async applyPatch(patch: ConfigObject): Promise<void> {
    await applyConfigPatch(this.store, patch, this.options);
  }

  async applyPathPatch(path: string | ConfigPath, value: unknown): Promise<void> {
    await applyConfigPathPatch(this.store, normalizeConfigPath(path), value, this.options);
  }

  async applyPathPatches(patches: ConfigPathPatch[]): Promise<void> {
    await applyConfigPathPatches(this.store, patches, this.options);
  }

  async applyEnvPatch(patch: Record<string, string | null | undefined>): Promise<void> {
    const operations = createEnvPathPatches(patch);
    await this.applyPathPatches(operations);
  }
}
