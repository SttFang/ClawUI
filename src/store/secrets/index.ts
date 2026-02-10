import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";

export interface SecretsState {
  discordBotToken: string;
  discordAppToken: string;
  telegramBotToken: string;
  slackBotToken: string;
  slackAppToken: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveSuccess: boolean;
}

export interface SecretsActions {
  load: () => Promise<void>;
  setValue: (
    key: keyof Pick<
      SecretsState,
      "discordBotToken" | "discordAppToken" | "telegramBotToken" | "slackBotToken" | "slackAppToken"
    >,
    value: string,
  ) => void;
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
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
};

export const useSecretsStore = create<SecretsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      load: async () => {
        set({ isLoading: true, error: null }, false, "load");
        try {
          const config = await ipc.config.get();
          const env = (config as { env?: Record<string, string> })?.env ?? {};
          set(
            {
              discordBotToken: env.DISCORD_BOT_TOKEN ?? "",
              discordAppToken: env.DISCORD_APP_TOKEN ?? "",
              telegramBotToken: env.TELEGRAM_BOT_TOKEN ?? "",
              slackBotToken: env.SLACK_BOT_TOKEN ?? "",
              slackAppToken: env.SLACK_APP_TOKEN ?? "",
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
        set({ [key]: value, saveSuccess: false } as Partial<SecretsState>, false, "setValue");
      },

      save: async () => {
        const { discordBotToken, discordAppToken, telegramBotToken, slackBotToken, slackAppToken } =
          get();

        set({ isSaving: true, error: null, saveSuccess: false }, false, "save");
        try {
          await ipc.secrets.patch({
            DISCORD_BOT_TOKEN: discordBotToken,
            DISCORD_APP_TOKEN: discordAppToken,
            TELEGRAM_BOT_TOKEN: telegramBotToken,
            SLACK_BOT_TOKEN: slackBotToken,
            SLACK_APP_TOKEN: slackAppToken,
          });
          set({ isSaving: false, saveSuccess: true }, false, "save/success");
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
