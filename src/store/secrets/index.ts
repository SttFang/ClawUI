import type { ChannelCredentialMeta } from "@clawui/types/credentials";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";

type TokenFieldKey =
  | "discordBotToken"
  | "discordAppToken"
  | "telegramBotToken"
  | "slackBotToken"
  | "slackAppToken";

const TOKEN_FIELD_MAP: Record<
  TokenFieldKey,
  { channelType: string; tokenField: "botToken" | "appToken" }
> = {
  discordBotToken: { channelType: "discord", tokenField: "botToken" },
  discordAppToken: { channelType: "discord", tokenField: "appToken" },
  telegramBotToken: { channelType: "telegram", tokenField: "botToken" },
  slackBotToken: { channelType: "slack", tokenField: "botToken" },
  slackAppToken: { channelType: "slack", tokenField: "appToken" },
};

export interface SecretsState {
  discordBotToken: string;
  discordAppToken: string;
  telegramBotToken: string;
  slackBotToken: string;
  slackAppToken: string;
  /** Tracks which fields the user has edited since load. */
  dirtyFields: Set<TokenFieldKey>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;
}

export interface SecretsActions {
  load: () => Promise<void>;
  setValue: (key: TokenFieldKey, value: string) => void;
  save: () => Promise<void>;
  clearSaveSuccess: () => void;
}

export type SecretsStore = SecretsState & SecretsActions;

const initialState: SecretsState = {
  discordBotToken: "",
  discordAppToken: "",
  telegramBotToken: "",
  slackBotToken: "",
  slackAppToken: "",
  dirtyFields: new Set(),
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
};

function findChannelMeta(
  credentials: ChannelCredentialMeta[],
  channelType: string,
  tokenField: string,
): ChannelCredentialMeta | undefined {
  return credentials.find((c) => c.channelType === channelType && c.tokenField === tokenField);
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

          const values: Partial<Record<TokenFieldKey, string>> = {};
          for (const [key, { channelType, tokenField }] of Object.entries(TOKEN_FIELD_MAP)) {
            const meta = findChannelMeta(channelCreds, channelType, tokenField);
            values[key as TokenFieldKey] = meta?.maskedValue ?? "";
          }

          set(
            {
              ...values,
              dirtyFields: new Set(),
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

      setValue: (key, value) => {
        const dirtyFields = new Set(get().dirtyFields);
        dirtyFields.add(key);
        set(
          { [key]: value, dirtyFields, saveSuccess: false } as Partial<SecretsState>,
          false,
          "setValue",
        );
      },

      save: async () => {
        const state = get();
        const { dirtyFields } = state;
        if (dirtyFields.size === 0) return;

        set({ isSaving: true, error: null, saveSuccess: false }, false, "save");
        try {
          for (const key of dirtyFields) {
            const mapping = TOKEN_FIELD_MAP[key];
            const value = state[key];
            await ipc.credentials.setChannel({
              channelType: mapping.channelType,
              tokenField: mapping.tokenField,
              value,
            });
          }
          set(
            { isSaving: false, saveSuccess: true, dirtyFields: new Set() },
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
