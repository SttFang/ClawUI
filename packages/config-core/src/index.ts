export { createEnvPathPatches, readConfigEnvVars } from "./env";
export { ConfigCoreManager } from "./manager";
export { getConfigPathValue, normalizeConfigPath } from "./path";
export { applyConfigPatch, applyConfigPathPatch, applyConfigPathPatches } from "./transaction";
export type {
  ConfigCoreOptions,
  ConfigDraftActionsLike,
  ConfigDraftStateLike,
  ConfigDraftStoreLike,
  ConfigObject,
  ConfigPath,
  ConfigPathPatch,
  ConfigPathSegment,
  ConfigReadSource,
  ConfigSnapshotLike,
} from "./types";
