import type {
  ConfigCoreOptions,
  ConfigDraftStoreLike,
  ConfigObject,
  ConfigPath,
  ConfigPathPatch,
} from "./types";

type ConfigError = Error & { code?: unknown };

function isBaseHashConflict(error: unknown): boolean {
  return (error as ConfigError | null)?.code === "CONFIG_BASE_HASH_CONFLICT";
}

async function ensureSnapshotLoaded(store: ConfigDraftStoreLike): Promise<void> {
  const { snapshot, loadSnapshot } = store.getState();
  if (!snapshot) {
    await loadSnapshot();
  }
}

interface TransactionContext {
  patchDraft: (patch: ConfigObject) => Promise<void>;
  patchDraftPath: (path: Array<string | number>, value: unknown) => Promise<void>;
  applyDraft: () => Promise<void>;
  loadSnapshot: (force?: boolean) => Promise<void>;
}

async function commitTransaction(
  store: ConfigDraftStoreLike,
  runner: (ctx: TransactionContext) => Promise<void>,
  options?: ConfigCoreOptions,
): Promise<void> {
  await ensureSnapshotLoaded(store);

  const maxRetries = Math.max(0, options?.conflictRetryCount ?? 1);
  let attempts = 0;

  while (true) {
    const state = store.getState();
    try {
      await runner(state);
      await state.applyDraft();
      return;
    } catch (error) {
      if (!isBaseHashConflict(error) || attempts >= maxRetries) {
        throw error;
      }
      attempts += 1;
      await state.loadSnapshot(true);
    }
  }
}

export async function applyConfigPatch(
  store: ConfigDraftStoreLike,
  patch: ConfigObject,
  options?: ConfigCoreOptions,
): Promise<void> {
  await commitTransaction(
    store,
    async ({ patchDraft }) => {
      await patchDraft(patch);
    },
    options,
  );
}

export async function applyConfigPathPatch(
  store: ConfigDraftStoreLike,
  path: ConfigPath,
  value: unknown,
  options?: ConfigCoreOptions,
): Promise<void> {
  await commitTransaction(
    store,
    async ({ patchDraftPath }) => {
      await patchDraftPath([...path], value);
    },
    options,
  );
}

export async function applyConfigPathPatches(
  store: ConfigDraftStoreLike,
  patches: ConfigPathPatch[],
  options?: ConfigCoreOptions,
): Promise<void> {
  if (patches.length === 0) return;

  await commitTransaction(
    store,
    async ({ patchDraftPath }) => {
      for (const patch of patches) {
        await patchDraftPath([...patch.path], patch.value);
      }
    },
    options,
  );
}
