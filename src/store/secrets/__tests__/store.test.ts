import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { configCoreManager } from "@/store/configDraft/manager";
import { useSecretsStore } from "../index";

vi.mock("@/store/configDraft/manager", () => ({
  configCoreManager: {
    loadSnapshot: vi.fn(),
    getEnv: vi.fn(() => ({})),
    applyEnvPatch: vi.fn(),
  },
}));

describe("SecretsStore", () => {
  beforeEach(() => {
    useSecretsStore.setState({
      discordBotToken: "",
      discordAppToken: "",
      telegramBotToken: "",
      slackBotToken: "",
      slackAppToken: "",
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    });
    vi.clearAllMocks();
    vi.useFakeTimers();

    (configCoreManager.loadSnapshot as Mock).mockResolvedValue(undefined);
    (configCoreManager.getEnv as Mock).mockReturnValue({});
    (configCoreManager.applyEnvPatch as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads secrets from config snapshot env", async () => {
    (configCoreManager.getEnv as Mock).mockReturnValue({
      DISCORD_BOT_TOKEN: "bot",
      DISCORD_APP_TOKEN: "app",
    });

    await useSecretsStore.getState().load();

    const state = useSecretsStore.getState();
    expect(configCoreManager.loadSnapshot).toHaveBeenCalled();
    expect(state.discordBotToken).toBe("bot");
    expect(state.discordAppToken).toBe("app");
    expect(state.isLoading).toBe(false);
  });

  it("saves allowlisted secrets through config core manager", async () => {
    useSecretsStore.setState({
      discordBotToken: "bot",
      discordAppToken: "",
      telegramBotToken: "tg",
      slackBotToken: "",
      slackAppToken: "",
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    });

    await useSecretsStore.getState().save();

    expect(configCoreManager.applyEnvPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        DISCORD_BOT_TOKEN: "bot",
        TELEGRAM_BOT_TOKEN: "tg",
      }),
    );
    expect(useSecretsStore.getState().saveSuccess).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(useSecretsStore.getState().saveSuccess).toBe(false);
  });
});
