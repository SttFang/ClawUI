export type ConfigPathSegment = string | number;
export type ConfigPath = ReadonlyArray<ConfigPathSegment>;
export type ConfigObject = Record<string, unknown>;

export interface ConfigSnapshotLike {
  config: ConfigObject;
  hash: string | null;
}

export interface ConfigDraftStateLike {
  snapshot: ConfigSnapshotLike | null;
  draft: ConfigObject | null;
}

export interface ConfigDraftActionsLike {
  loadSnapshot: (force?: boolean) => Promise<void>;
  patchDraft: (patch: ConfigObject) => Promise<void>;
  patchDraftPath: (path: Array<string | number>, value: unknown) => Promise<void>;
  applyDraft: () => Promise<void>;
}

export interface ConfigDraftStoreLike<State extends ConfigDraftStateLike = ConfigDraftStateLike> {
  getState: () => State & ConfigDraftActionsLike;
}

export interface ConfigPathPatch {
  path: ConfigPath;
  value: unknown;
}

export interface ConfigCoreOptions {
  conflictRetryCount?: number;
}
