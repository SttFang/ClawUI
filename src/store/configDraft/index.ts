import type { ConfigErrorCode, ConfigSchemaV2, ConfigSnapshotV2 } from "@clawui/types/config-v2";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";
import { uiLog } from "@/lib/logger";
import {
  deepMergeDraft,
  ensureDraftObject,
  setDraftPath as setDraftPathValue,
} from "./draftObject";

type ConfigDraftObject = Record<string, unknown>;

interface ConfigDraftState {
  snapshot: ConfigSnapshotV2 | null;
  schema: ConfigSchemaV2 | null;
  draft: ConfigDraftObject | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  errorCode: ConfigErrorCode | null;
}

interface ConfigDraftActions {
  loadSnapshot: (force?: boolean) => Promise<void>;
  loadSchema: (force?: boolean) => Promise<void>;
  patchDraft: (patch: ConfigDraftObject) => Promise<void>;
  patchDraftPath: (path: Array<string | number>, value: unknown) => Promise<void>;
  resetDraftToSnapshot: () => Promise<void>;
  resetDraft: () => Promise<void>;
  applyDraft: () => Promise<void>;
  applyPatch: (patch: ConfigDraftObject) => Promise<void>;
  applyPathPatch: (path: Array<string | number>, value: unknown) => Promise<void>;
}

type ConfigDraftStore = ConfigDraftState & ConfigDraftActions;

const initialState: ConfigDraftState = {
  snapshot: null,
  schema: null,
  draft: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,
  errorCode: null,
};

function readErrorCode(error: unknown): ConfigErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return null;
  if (
    code === "CONFIG_BASE_HASH_REQUIRED" ||
    code === "CONFIG_BASE_HASH_CONFLICT" ||
    code === "CONFIG_INVALID_RAW" ||
    code === "CONFIG_INVALID_SCHEMA" ||
    code === "CONFIG_WRITE_FAILED" ||
    code === "CONFIG_GATEWAY_UNAVAILABLE"
  ) {
    return code;
  }
  return null;
}

export const useConfigDraftStore = create<ConfigDraftStore>()(
  devtools(
    (set, get) => {
      const ensureDraftLoaded = async (): Promise<ConfigDraftObject> => {
        const currentDraft = get().draft;
        if (currentDraft) return currentDraft;
        await get().loadSnapshot();
        return get().draft ?? {};
      };

      const loadSnapshotInternal = async ({
        force,
        preserveDirtyDraft,
        action,
      }: {
        force: boolean;
        preserveDirtyDraft: boolean;
        action: string;
      }) => {
        if (!force && get().isLoading) return;
        set({ isLoading: true }, false, action);
        try {
          const snapshot = await ipc.config.getSnapshot();
          const shouldKeepDirtyDraft = preserveDirtyDraft && get().isDirty && get().draft;
          set(
            {
              snapshot,
              draft: shouldKeepDirtyDraft ? get().draft : ensureDraftObject(snapshot.config),
              isLoading: false,
              isDirty: shouldKeepDirtyDraft ? get().isDirty : false,
              error: null,
              errorCode: null,
            },
            false,
            `${action}/success`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load config snapshot";
          set(
            {
              isLoading: false,
              error: message,
            },
            false,
            `${action}/error`,
          );
          throw error;
        }
      };

      return {
        ...initialState,

        loadSnapshot: async (force = false) => {
          await loadSnapshotInternal({
            force,
            preserveDirtyDraft: true,
            action: "configDraft/loadSnapshot",
          });
        },

        loadSchema: async (force = false) => {
          if (!force && get().schema) return;
          try {
            const schema = await ipc.config.getSchema();
            set({ schema }, false, "configDraft/loadSchema/success");
          } catch (error) {
            uiLog.warn(
              "[configDraft.loadSchema.failed]",
              error instanceof Error ? error.message : String(error),
            );
          }
        },

        patchDraft: async (patch) => {
          const current = await ensureDraftLoaded();
          const merged = deepMergeDraft(current, patch);
          set(
            {
              draft: merged,
              isDirty: true,
              error: null,
              errorCode: null,
            },
            false,
            "configDraft/patchDraft",
          );
        },

        patchDraftPath: async (path, value) => {
          const current = await ensureDraftLoaded();
          const next = setDraftPathValue(current, path, value);
          set(
            {
              draft: next,
              isDirty: true,
              error: null,
              errorCode: null,
            },
            false,
            "configDraft/patchDraftPath",
          );
        },

        resetDraftToSnapshot: async () => {
          await loadSnapshotInternal({
            force: true,
            preserveDirtyDraft: false,
            action: "configDraft/resetDraftToSnapshot",
          });
        },

        resetDraft: async () => {
          await get().resetDraftToSnapshot();
        },

        applyDraft: async () => {
          const draft = await ensureDraftLoaded();
          const snapshot = get().snapshot;
          if (!snapshot) {
            throw new Error("Config snapshot unavailable");
          }
          set({ isSaving: true }, false, "configDraft/applyDraft");
          try {
            const raw = JSON.stringify(draft, null, 2).concat("\n");
            await ipc.config.setDraft({
              raw,
              baseHash: snapshot.hash ?? "",
            });
            set(
              {
                isSaving: false,
                isDirty: false,
                error: null,
                errorCode: null,
              },
              false,
              "configDraft/applyDraft/success",
            );
            await get().loadSnapshot(true);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to apply config draft";
            set(
              {
                isSaving: false,
                error: message,
                errorCode: readErrorCode(error),
              },
              false,
              "configDraft/applyDraft/error",
            );
            throw error;
          }
        },

        applyPatch: async (patch) => {
          await get().patchDraft(patch);
          await get().applyDraft();
        },

        applyPathPatch: async (path, value) => {
          await get().patchDraftPath(path, value);
          await get().applyDraft();
        },
      };
    },
    { name: "ConfigDraftStore" },
  ),
);

export const selectConfigDraft = (state: ConfigDraftStore) => state.draft;
export const selectConfigSnapshot = (state: ConfigDraftStore) => state.snapshot;
export const selectConfigDraftError = (state: ConfigDraftStore) => state.error;
export const selectConfigDraftErrorCode = (state: ConfigDraftStore) => state.errorCode;
export const selectConfigDraftSaving = (state: ConfigDraftStore) => state.isSaving;
