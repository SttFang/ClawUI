import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  net: { fetch: vi.fn() },
}));

vi.mock("../../../lib/logger", () => ({
  configLog: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { net } from "electron";
import { configLog } from "../../../lib/logger";
import type { AuthProfileCredential } from "../auth-profile-adapter";
import { OAuthService } from "../oauth-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthProfiles() {
  return {
    getProfile: vi.fn(),
    setProfile: vi.fn(),
    // unused but keeps the shape close to the real adapter
    read: vi.fn(),
    write: vi.fn(),
    deleteProfile: vi.fn(),
    hasKey: vi.fn(),
    updateWithLock: vi.fn(),
    getStorePath: vi.fn(),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const DEVICE_CODE_BODY = {
  device_code: "dc_abc",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
};

const COPILOT_TOKEN_BODY = {
  token: "copilot-jwt-xyz",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OAuthService", () => {
  let profiles: ReturnType<typeof mockAuthProfiles>;
  let service: OAuthService;
  const fetchMock = net.fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    profiles = mockAuthProfiles();
    service = new OAuthService(profiles as never);
  });

  // -----------------------------------------------------------------------
  // startDeviceCodeFlow
  // -----------------------------------------------------------------------
  describe("startDeviceCodeFlow", () => {
    it("github-copilot: sends device code request and returns DeviceCodeInfo", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(DEVICE_CODE_BODY));

      const info = await service.startDeviceCodeFlow("github-copilot");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://github.com/login/device/code");
      expect(opts.method).toBe("POST");

      expect(info).toEqual({
        deviceCode: "dc_abc",
        userCode: "ABCD-1234",
        verificationUri: "https://github.com/login/device",
        expiresIn: 900,
        interval: 5,
      });
    });

    it.each(["qwen-portal", "minimax-portal", "unknown-provider"])(
      "%s: throws unsupported provider",
      async (provider) => {
        await expect(service.startDeviceCodeFlow(provider)).rejects.toThrow(
          `Device code flow not supported for provider: ${provider}`,
        );
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it("throws when GitHub API returns non-200", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(null, 200), // response.json() works but we simulate a network-level throw
      );
      // Simulate json() rejecting (malformed body)
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("invalid json")),
      });

      await expect(service.startDeviceCodeFlow("github-copilot")).rejects.toThrow("invalid json");
    });
  });

  // -----------------------------------------------------------------------
  // pollDeviceCodeToken
  // -----------------------------------------------------------------------
  describe("pollDeviceCodeToken", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("github-copilot: polls, gets token, exchanges copilot token, saves profile", async () => {
      // 1st poll → authorization_pending
      // 2nd poll → access_token
      // then exchangeCopilotToken fetch
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: "authorization_pending" }))
        .mockResolvedValueOnce(jsonResponse({ access_token: "gh_token_123" }))
        .mockResolvedValueOnce(jsonResponse(COPILOT_TOKEN_BODY));

      const promise = service.pollDeviceCodeToken("github-copilot", "dc_abc", 1);

      // Advance past 1st interval (1s)
      await vi.advanceTimersByTimeAsync(1000);
      // Advance past 2nd interval (1s)
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result.profileId).toBe("github-copilot:default");
      expect(result.credential.type).toBe("oauth");
      expect(result.credential).toMatchObject({
        provider: "github-copilot",
        access: COPILOT_TOKEN_BODY.token,
        refresh: "gh_token_123",
      });
      expect(profiles.setProfile).toHaveBeenCalledWith("github-copilot:default", result.credential);
      expect(configLog.info).toHaveBeenCalled();
    });

    it("qwen-portal: throws immediately without polling", async () => {
      await expect(service.pollDeviceCodeToken("qwen-portal", "dc", 5)).rejects.toThrow(
        "Device code flow not supported for provider: qwen-portal",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("authorization_pending: continues polling", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: "authorization_pending" }))
        .mockResolvedValueOnce(jsonResponse({ error: "authorization_pending" }))
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
        .mockResolvedValueOnce(jsonResponse(COPILOT_TOKEN_BODY));

      const promise = service.pollDeviceCodeToken("github-copilot", "dc", 1);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result.credential.type).toBe("oauth");
      // 3 poll fetches + 1 copilot exchange = 4
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("slow_down: increases interval by 5 then continues", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ error: "slow_down" }))
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok" }))
        .mockResolvedValueOnce(jsonResponse(COPILOT_TOKEN_BODY));

      const promise = service.pollDeviceCodeToken("github-copilot", "dc", 1);

      // 1st poll at 1s
      await vi.advanceTimersByTimeAsync(1000);
      // After slow_down, interval becomes 6s
      await vi.advanceTimersByTimeAsync(6000);

      const result = await promise;
      expect(result.credential.type).toBe("oauth");
    });

    it("other error: throws OAuth error", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "access_denied" }));

      const promise = service.pollDeviceCodeToken("github-copilot", "dc", 1);
      promise.catch(() => {}); // prevent unhandled rejection warning
      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow("OAuth error: access_denied");
    });

    it("exceeds maxAttempts: throws timeout", async () => {
      // Always return authorization_pending
      fetchMock.mockResolvedValue(jsonResponse({ error: "authorization_pending" }));

      const promise = service.pollDeviceCodeToken("github-copilot", "dc", 1);
      promise.catch(() => {}); // prevent unhandled rejection warning

      // Advance enough for 60 iterations (interval=1s each)
      for (let i = 0; i < 60; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await expect(promise).rejects.toThrow("Device code flow timed out");
    });
  });

  // -----------------------------------------------------------------------
  // refreshIfNeeded
  // -----------------------------------------------------------------------
  describe("refreshIfNeeded", () => {
    const FIVE_MIN = 5 * 60 * 1000;

    it("returns false when profile does not exist", async () => {
      profiles.getProfile.mockResolvedValueOnce(null);
      expect(await service.refreshIfNeeded("missing")).toBe(false);
    });

    it("returns false for non-oauth type", async () => {
      profiles.getProfile.mockResolvedValueOnce({ type: "api_key", provider: "openai" });
      expect(await service.refreshIfNeeded("openai:default")).toBe(false);
    });

    it("returns false when token is not near expiry (>5min buffer)", async () => {
      const cred: AuthProfileCredential = {
        type: "oauth",
        provider: "github-copilot",
        access: "a",
        refresh: "r",
        expires: Date.now() + FIVE_MIN + 60_000, // 6 min from now
      };
      profiles.getProfile.mockResolvedValueOnce(cred);
      expect(await service.refreshIfNeeded("github-copilot:default")).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refreshes and returns true when token is about to expire", async () => {
      const cred: AuthProfileCredential = {
        type: "oauth",
        provider: "github-copilot",
        access: "old",
        refresh: "gh_refresh",
        expires: Date.now() + FIVE_MIN - 1000, // within buffer
      };
      profiles.getProfile.mockResolvedValueOnce(cred);
      fetchMock.mockResolvedValueOnce(jsonResponse(COPILOT_TOKEN_BODY));

      expect(await service.refreshIfNeeded("github-copilot:default")).toBe(true);
      expect(profiles.setProfile).toHaveBeenCalledOnce();

      const saved = profiles.setProfile.mock.calls[0][1] as AuthProfileCredential;
      expect(saved).toMatchObject({
        type: "oauth",
        access: COPILOT_TOKEN_BODY.token,
        refresh: "gh_refresh",
      });
      expect(configLog.info).toHaveBeenCalled();
    });

    it("returns false and logs error when refresh fails", async () => {
      const cred: AuthProfileCredential = {
        type: "oauth",
        provider: "github-copilot",
        access: "old",
        refresh: "bad_token",
        expires: Date.now(), // already expired
      };
      profiles.getProfile.mockResolvedValueOnce(cred);
      fetchMock.mockResolvedValueOnce(jsonResponse("Unauthorized", 401));

      expect(await service.refreshIfNeeded("github-copilot:default")).toBe(false);
      expect(configLog.error).toHaveBeenCalled();
      expect(profiles.setProfile).not.toHaveBeenCalled();
    });
  });
});
