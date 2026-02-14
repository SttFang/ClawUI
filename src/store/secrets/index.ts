import type { ChannelCredentialMeta, ToolCredentialMeta } from "@clawui/types/credentials";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";

export interface SecretsState {
  /** key: "discord:token", value: masked/input */
  channelValues: Record<string, string>;
  /** key: "web_search_brave", value: masked/input */
  toolValues: Record<string, string>;
  dirtyChannels: Set<string>;
  dirtyTools: Set<string>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;
}

export interface SecretsActions {
  load: () => Promise<void>;
  setChannelValue: (key: string, value: string) => void;
  setToolValue: (key: string, value: string) => void;
  save: () => Promise<void>;
  clearSaveSuccess: () => void;
}

export type SecretsStore = SecretsState & SecretsActions;

const initialState: SecretsState = {
  channelValues: {},
  toolValues: {},
  dirtyChannels: new Set(),
  dirtyTools: new Set(),
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
};

/** Compose channel key from channelType + field. */
function channelKey(channelType: string, field: string): string {
  return `${channelType}:${field}`;
}

export const useSecretsStore = create<SecretsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      load: async () => {
        set({ isLoading: true, error: null }, false, "load");
        try {
          const allCredentials = await ipc.credentials.list();

          const channelCreds = allCredentials.filter(
            (c): c is ChannelCredentialMeta => c.category === "channel",
          );
          const toolCreds = allCredentials.filter(
            (c): c is ToolCredentialMeta => c.category === "tool",
          );

          const channelValues: Record<string, string> = {};
          for (const c of channelCreds) {
            channelValues[channelKey(c.channelType, c.tokenField)] = c.maskedValue;
          }

          const toolValues: Record<string, string> = {};
          for (const t of toolCreds) {
            toolValues[t.toolId] = t.maskedValue;
          }

          set(
            {
              channelValues,
              toolValues,
              dirtyChannels: new Set(),
              dirtyTools: new Set(),
              isLoading: false,
            },
            false,
            "load/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load secrets";
          set({ error: message, isLoading: false }, false, "load/error");
        }
      },

      setChannelValue: (key, value) => {
        const channelValues = { ...get().channelValues, [key]: value };
        const dirtyChannels = new Set(get().dirtyChannels);
        dirtyChannels.add(key);
        set({ channelValues, dirtyChannels, saveSuccess: false }, false, "setChannelValue");
      },

      setToolValue: (key, value) => {
        const toolValues = { ...get().toolValues, [key]: value };
        const dirtyTools = new Set(get().dirtyTools);
        dirtyTools.add(key);
        set({ toolValues, dirtyTools, saveSuccess: false }, false, "setToolValue");
      },

      save: async () => {
        const state = get();
        const { dirtyChannels, dirtyTools } = state;
        if (dirtyChannels.size === 0 && dirtyTools.size === 0) return;

        set({ isSaving: true, error: null, saveSuccess: false }, false, "save");
        try {
          // Save dirty channel values
          for (const key of dirtyChannels) {
            const [channelType, tokenField] = key.split(":");
            if (!channelType || !tokenField) continue;
            await ipc.credentials.setChannel({
              channelType,
              tokenField,
              value: state.channelValues[key] ?? "",
            });
          }

          // Save dirty tool values
          for (const toolId of dirtyTools) {
            await ipc.credentials.setToolKey({
              toolId,
              value: state.toolValues[toolId] ?? "",
            });
          }

          set(
            {
              isSaving: false,
              saveSuccess: true,
              dirtyChannels: new Set(),
              dirtyTools: new Set(),
            },
            false,
            "save/success",
          );
          setTimeout(() => set({ saveSuccess: false }, false, "save/clearSuccess"), 3000);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save secrets";
          set({ error: message, isSaving: false }, false, "save/error");
        }
      },

      clearSaveSuccess: () => set({ saveSuccess: false }, false, "clearSaveSuccess"),
    }),
    { name: "SecretsStore" },
  ),
);

export const selectSecretsLoading = (state: SecretsStore) => state.isLoading;
export const selectSecretsSaving = (state: SecretsStore) => state.isSaving;
export const selectSecretsError = (state: SecretsStore) => state.error;
export const selectSecretsSaveSuccess = (state: SecretsStore) => state.saveSuccess;

export const secretsSelectors = {
  selectSecretsLoading,
  selectSecretsSaving,
  selectSecretsError,
  selectSecretsSaveSuccess,
};
