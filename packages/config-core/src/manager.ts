import type {
  ConfigCoreOptions,
  ConfigDraftStoreLike,
  ConfigObject,
  ConfigPath,
  ConfigPathPatch,
  ConfigReadSource,
} from "./types";
import { createEnvPathPatches, readConfigEnvVars } from "./env";
import { getConfigPathValue, normalizeConfigPath } from "./path";
import { applyConfigPatch, applyConfigPathPatch, applyConfigPathPatches } from "./transaction";

const DEFAULT_READ_SOURCE: ConfigReadSource = "snapshot";

function readCurrentConfig(store: ConfigDraftStoreLike, source: ConfigReadSource): ConfigObject {
  const state = store.getState();
  if (source === "snapshot") {
    return state.snapshot?.config ?? {};
  }
  return state.draft ?? state.snapshot?.config ?? {};
}

export class ConfigCoreManager {
  private readonly options: ConfigCoreOptions;

  constructor(
    private readonly store: ConfigDraftStoreLike,
    options: ConfigCoreOptions = {},
  ) {
    this.options = options;
  }

  private resolveReadSource(source?: ConfigReadSource): ConfigReadSource {
    return source ?? this.options.readSource ?? DEFAULT_READ_SOURCE;
  }

  async loadSnapshot(force = false): Promise<void> {
    await this.store.getState().loadSnapshot(force);
  }

  getConfig(source?: ConfigReadSource): ConfigObject {
    return readCurrentConfig(this.store, this.resolveReadSource(source));
  }

  getPath(path: string | ConfigPath, source?: ConfigReadSource): unknown {
    return getConfigPathValue(this.getConfig(source), path);
  }

  getEnv(source?: ConfigReadSource): Record<string, string> {
    return readConfigEnvVars(this.getConfig(source));
  }

  getEnvValue(key: string, source?: ConfigReadSource): string {
    return this.getEnv(source)[key] ?? "";
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
