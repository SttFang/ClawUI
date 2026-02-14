import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSecretsStore } from "../index";

const mockCredentialsList = vi.fn();
const mockSetChannel = vi.fn();
const mockSetToolKey = vi.fn();

vi.mock("@/lib/ipc", () => ({
  ipc: {
    credentials: {
      list: (...args: unknown[]) => mockCredentialsList(...args),
      setChannel: (...args: unknown[]) => mockSetChannel(...args),
      setToolKey: (...args: unknown[]) => mockSetToolKey(...args),
    },
  },
}));

describe("SecretsStore", () => {
  beforeEach(() => {
    useSecretsStore.setState({
      channelValues: {},
      toolValues: {},
      dirtyChannels: new Set(),
      dirtyTools: new Set(),
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    });
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockCredentialsList.mockResolvedValue([]);
    mockSetChannel.mockResolvedValue(undefined);
    mockSetToolKey.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads masked credentials from ipc.credentials.list", async () => {
    mockCredentialsList.mockResolvedValue([
      {
        category: "channel",
        channelType: "discord",
        tokenField: "token",
        maskedValue: "bot***...xyz",
        hasValue: true,
      },
      {
        category: "tool",
        toolId: "web_search_brave",
        maskedValue: "BSA***...abc",
        hasValue: true,
      },
    ]);

    await useSecretsStore.getState().load();

    const state = useSecretsStore.getState();
    expect(mockCredentialsList).toHaveBeenCalled();
    expect(state.channelValues["discord:token"]).toBe("bot***...xyz");
    expect(state.toolValues["web_search_brave"]).toBe("BSA***...abc");
    expect(state.isLoading).toBe(false);
  });

  it("saves only dirty channel fields via ipc.credentials.setChannel", async () => {
    useSecretsStore.setState({
      channelValues: { "discord:token": "new-bot-token", "telegram:botToken": "new-tg-token" },
      dirtyChannels: new Set(["discord:token", "telegram:botToken"]),
    });

    await useSecretsStore.getState().save();

    expect(mockSetChannel).toHaveBeenCalledTimes(2);
    expect(mockSetChannel).toHaveBeenCalledWith({
      channelType: "discord",
      tokenField: "token",
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

  it("saves dirty tool fields via ipc.credentials.setToolKey", async () => {
    useSecretsStore.setState({
      toolValues: { web_search_brave: "BSA12345" },
      dirtyTools: new Set(["web_search_brave"]),
    });

    await useSecretsStore.getState().save();

    expect(mockSetToolKey).toHaveBeenCalledTimes(1);
    expect(mockSetToolKey).toHaveBeenCalledWith({
      toolId: "web_search_brave",
      value: "BSA12345",
    });
    expect(useSecretsStore.getState().saveSuccess).toBe(true);
  });

  it("does not save when no fields are dirty", async () => {
    useSecretsStore.setState({
      dirtyChannels: new Set(),
      dirtyTools: new Set(),
    });

    await useSecretsStore.getState().save();

    expect(mockSetChannel).not.toHaveBeenCalled();
    expect(mockSetToolKey).not.toHaveBeenCalled();
  });
});
