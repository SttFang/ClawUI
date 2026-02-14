import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSecretsStore } from "../index";

const mockCredentialsList = vi.fn();
const mockSetChannel = vi.fn();

vi.mock("@/lib/ipc", () => ({
  ipc: {
    credentials: {
      list: (...args: unknown[]) => mockCredentialsList(...args),
      setChannel: (...args: unknown[]) => mockSetChannel(...args),
    },
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
      dirtyFields: new Set(),
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    });
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockCredentialsList.mockResolvedValue([]);
    mockSetChannel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads masked credentials from ipc.credentials.list", async () => {
    mockCredentialsList.mockResolvedValue([
      {
        category: "channel",
        channelType: "discord",
        tokenField: "botToken",
        maskedValue: "bot***...xyz",
        hasValue: true,
      },
      {
        category: "channel",
        channelType: "discord",
        tokenField: "appToken",
        maskedValue: "app***...abc",
        hasValue: true,
      },
    ]);

    await useSecretsStore.getState().load();

    const state = useSecretsStore.getState();
    expect(mockCredentialsList).toHaveBeenCalled();
    expect(state.discordBotToken).toBe("bot***...xyz");
    expect(state.discordAppToken).toBe("app***...abc");
    expect(state.isLoading).toBe(false);
  });

  it("saves only dirty fields via ipc.credentials.setChannel", async () => {
    useSecretsStore.setState({
      discordBotToken: "new-bot-token",
      telegramBotToken: "new-tg-token",
      dirtyFields: new Set(["discordBotToken", "telegramBotToken"]),
    });

    await useSecretsStore.getState().save();

    expect(mockSetChannel).toHaveBeenCalledTimes(2);
    expect(mockSetChannel).toHaveBeenCalledWith({
      channelType: "discord",
      tokenField: "botToken",
      value: "new-bot-token",
    });
    expect(mockSetChannel).toHaveBeenCalledWith({
      channelType: "telegram",
      tokenField: "botToken",
      value: "new-tg-token",
    });
    expect(useSecretsStore.getState().saveSuccess).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(useSecretsStore.getState().saveSuccess).toBe(false);
  });

  it("does not save when no fields are dirty", async () => {
    useSecretsStore.setState({ dirtyFields: new Set() });

    await useSecretsStore.getState().save();

    expect(mockSetChannel).not.toHaveBeenCalled();
  });
});
