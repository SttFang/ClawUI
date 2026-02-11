import type { ModelsStatus } from "@clawui/types/models";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, getElectronAPI } from "@/lib/ipc";
import {
  buildProviderEnvPatch,
  hydrateApiKeysFromModelsStatus,
  readApiKeysFromEnv,
} from "./providerConfigMiddleware";
import { getKnownProviderIds, setApiKeyInputValue } from "./providerRegistry";

export type ApiKeys = Record<string, string>;

interface SettingsState {
  apiKeys: ApiKeys;
  autoStartGateway: boolean;
  autoCheckUpdates: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;
  modelsStatus: ModelsStatus | null;
  modelsLoading: boolean;
}

interface SettingsActions {
  loadSettings: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  setApiKey: (provider: string, key: string) => void;
  saveApiKeys: (providerId?: string) => Promise<void>;
  setAutoStartGateway: (enabled: boolean) => Promise<void>;
  setAutoCheckUpdates: (enabled: boolean) => Promise<void>;
  clearSaveSuccess: () => void;
  loadModelsStatus: () => Promise<void>;
}

type SettingsStore = SettingsState & SettingsActions;

const initialState: SettingsState = {
  apiKeys: {
    anthropic: "",
    openai: "",
    openrouter: "",
  },
  autoStartGateway: true,
  autoCheckUpdates: true,
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
  modelsStatus: null,
  modelsLoading: false,
};

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSettings: async () => {
        set({ isLoading: true, error: null }, false, "loadSettings");
        try {
          const config = await ipc.config.get();
          if (config) {
            const env = (config as { env?: Record<string, string> }).env || {};
            const loadedApiKeys = readApiKeysFromEnv(env);
            set(
              (state) => ({
                apiKeys: (() => {
                  const next: ApiKeys = { ...state.apiKeys };
                  for (const providerId of getKnownProviderIds()) {
                    next[providerId] = loadedApiKeys[providerId] ?? "";
                  }
                  for (const [providerId, value] of Object.entries(loadedApiKeys)) {
                    next[providerId] = value;
                  }
                  return next;
                })(),
                isLoading: false,
              }),
              false,
              "loadSettings/success",
            );
          } else {
            set({ isLoading: false }, false, "loadSettings/empty");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load settings";
          set({ error: message, isLoading: false }, false, "loadSettings/error");
        }
      },

      loadModelsStatus: async () => {
        set({ modelsLoading: true }, false, "loadModelsStatus");
        try {
          const status = await ipc.models.status();
          const config = await ipc.config.get();
          const env = ((config as { env?: Record<string, string> } | null)?.env ?? {}) as Record<
            string,
            string | undefined
          >;
          set(
            (state) => ({
              modelsStatus: status,
              apiKeys: hydrateApiKeysFromModelsStatus({
                apiKeys: state.apiKeys,
                modelsStatus: status,
                env,
              }),
              modelsLoading: false,
            }),
            false,
            "loadModelsStatus/success",
          );
        } catch {
          set({ modelsStatus: null, modelsLoading: false }, false, "loadModelsStatus/error");
        }
      },

      loadPreferences: async () => {
        try {
          const state = await ipc.state.get();
          set(
            {
              autoStartGateway: state.openclaw?.autoStart?.main ?? true,
              autoCheckUpdates: state.app?.autoCheckUpdates ?? true,
            },
            false,
            "loadPreferences",
          );
        } catch {
          // Best-effort: keep defaults.
        }
      },

      setApiKey: (provider, key) => {
        set(
          (state) => ({
            apiKeys: setApiKeyInputValue(state.apiKeys, provider, key),
            saveSuccess: false,
          }),
          false,
          "setApiKey",
        );
      },

      saveApiKeys: async (providerId?: string) => {
        const { apiKeys, modelsStatus } = get();
        set({ isSaving: true, error: null, saveSuccess: false }, false, "saveApiKeys");

        try {
          const patch = buildProviderEnvPatch({ apiKeys, modelsStatus, providerId });

          if (!getElectronAPI()) {
            throw new Error("Electron API not available. Are you running in Electron?");
          }

          if (Object.keys(patch).length > 0) {
            await ipc.profiles.patchEnvBoth(patch);
          }
          set({ isSaving: false, saveSuccess: true }, false, "saveApiKeys/success");

          setTimeout(() => {
            set({ saveSuccess: false }, false, "saveApiKeys/clearSuccess");
          }, 3000);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save API keys";
          set({ error: message, isSaving: false }, false, "saveApiKeys/error");
        }
      },

      setAutoStartGateway: async (enabled) => {
        set({ autoStartGateway: enabled }, false, "setAutoStartGateway");
        await ipc.state.patch({ openclaw: { autoStart: { main: enabled } } });
      },

      setAutoCheckUpdates: async (enabled) => {
        set({ autoCheckUpdates: enabled }, false, "setAutoCheckUpdates");
        await ipc.state.patch({ app: { autoCheckUpdates: enabled } });
      },

      clearSaveSuccess: () => {
        set({ saveSuccess: false }, false, "clearSaveSuccess");
      },
    }),
    { name: "SettingsStore" },
  ),
);

// Selectors
export const selectApiKeys = (state: SettingsStore) => state.apiKeys;
export const selectAutoStartGateway = (state: SettingsStore) => state.autoStartGateway;
export const selectAutoCheckUpdates = (state: SettingsStore) => state.autoCheckUpdates;
export const selectIsLoading = (state: SettingsStore) => state.isLoading;
export const selectIsSaving = (state: SettingsStore) => state.isSaving;
export const selectError = (state: SettingsStore) => state.error;
export const selectSaveSuccess = (state: SettingsStore) => state.saveSuccess;
export const selectModelsStatus = (state: SettingsStore) => state.modelsStatus;
export const selectModelsLoading = (state: SettingsStore) => state.modelsLoading;

export const settingsSelectors = {
  selectApiKeys,
  selectAutoStartGateway,
  selectAutoCheckUpdates,
  selectIsLoading,
  selectIsSaving,
  selectError,
  selectSaveSuccess,
  selectModelsStatus,
  selectModelsLoading,
};
