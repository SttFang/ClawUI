import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerCredentialHandlers } from "../credentials";

const createIpcMain = () => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown> | unknown>();
  return {
    handlers,
    handle: vi.fn((event: string, handler: (...args: unknown[]) => Promise<unknown> | unknown) => {
      handlers.set(event, handler);
    }),
  };
};

const createCredentialService = () => ({
  getAllCredentials: vi.fn(),
  setLlmKey: vi.fn(),
  validateLlmKey: vi.fn(),
  setChannelToken: vi.fn(),
  setProxy: vi.fn(),
  setToolApiKey: vi.fn(),
  deleteCredential: vi.fn(),
});

const createOAuthService = () => ({
  startDeviceCodeFlow: vi.fn(),
  pollDeviceCodeToken: vi.fn(),
  refreshIfNeeded: vi.fn(),
});

describe("registerCredentialHandlers", () => {
  let ipcMain: ReturnType<typeof createIpcMain>;
  let credentialService: ReturnType<typeof createCredentialService>;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcMain = createIpcMain();
    credentialService = createCredentialService();
  });

  const invoke = (channel: string, ...args: unknown[]) => {
    const handler = ipcMain.handlers.get(channel);
    expect(handler).toBeTypeOf("function");
    return handler!({} as never, ...args);
  };

  describe("credentials:oauth-device-start", () => {
    it("calls startDeviceCodeFlow when oauthService exists", async () => {
      const oauthService = createOAuthService();
      oauthService.startDeviceCodeFlow.mockResolvedValue({ device_code: "abc", user_code: "XY" });

      registerCredentialHandlers(
        ipcMain as never,
        credentialService as never,
        oauthService as never,
      );

      const result = await invoke("credentials:oauth-device-start", "github");
      expect(oauthService.startDeviceCodeFlow).toHaveBeenCalledWith("github");
      expect(result).toEqual({ device_code: "abc", user_code: "XY" });
    });

    it("throws when oauthService is undefined", async () => {
      registerCredentialHandlers(ipcMain as never, credentialService as never);

      await expect(invoke("credentials:oauth-device-start", "github")).rejects.toThrow(
        "OAuth service not available",
      );
    });

    it("propagates error from startDeviceCodeFlow", async () => {
      const oauthService = createOAuthService();
      oauthService.startDeviceCodeFlow.mockRejectedValue(new Error("network failure"));

      registerCredentialHandlers(
        ipcMain as never,
        credentialService as never,
        oauthService as never,
      );

      await expect(invoke("credentials:oauth-device-start", "github")).rejects.toThrow(
        "network failure",
      );
    });
  });

  describe("credentials:oauth-device-poll", () => {
    it("passes provider/deviceCode/interval to pollDeviceCodeToken", async () => {
      const oauthService = createOAuthService();
      oauthService.pollDeviceCodeToken.mockResolvedValue({ access_token: "tok" });

      registerCredentialHandlers(
        ipcMain as never,
        credentialService as never,
        oauthService as never,
      );

      const result = await invoke("credentials:oauth-device-poll", "github", "dev-123", 5);
      expect(oauthService.pollDeviceCodeToken).toHaveBeenCalledWith("github", "dev-123", 5);
      expect(result).toEqual({ access_token: "tok" });
    });

    it("throws when oauthService is undefined", async () => {
      registerCredentialHandlers(ipcMain as never, credentialService as never);

      await expect(invoke("credentials:oauth-device-poll", "github", "dev-123", 5)).rejects.toThrow(
        "OAuth service not available",
      );
    });
  });

  describe("credentials:oauth-refresh", () => {
    it("passes profileId to refreshIfNeeded", async () => {
      const oauthService = createOAuthService();
      oauthService.refreshIfNeeded.mockResolvedValue({ refreshed: true });

      registerCredentialHandlers(
        ipcMain as never,
        credentialService as never,
        oauthService as never,
      );

      const result = await invoke("credentials:oauth-refresh", "profile-456");
      expect(oauthService.refreshIfNeeded).toHaveBeenCalledWith("profile-456");
      expect(result).toEqual({ refreshed: true });
    });

    it("throws when oauthService is undefined", async () => {
      registerCredentialHandlers(ipcMain as never, credentialService as never);

      await expect(invoke("credentials:oauth-refresh", "profile-456")).rejects.toThrow(
        "OAuth service not available",
      );
    });
  });
});
