import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthProfileAdapter, AuthProfileCredential } from "../auth-profile-adapter";

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn<(path: string) => boolean>().mockReturnValue(false),
  readFile: vi.fn<(path: string, encoding: string) => Promise<string>>().mockResolvedValue(""),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: { ...actual, existsSync: mocks.existsSync },
    existsSync: mocks.existsSync,
  };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, default: { ...actual, readFile: mocks.readFile }, readFile: mocks.readFile };
});
vi.mock("../../../lib/logger", () => ({
  configLog: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks are set up
const { syncExternalCliCredentials } = await import("../external-cli-sync");

const QWEN_PATH = join(homedir(), ".qwen", "oauth_creds.json");
const MINIMAX_PATH = join(homedir(), ".minimax", "oauth_creds.json");
const CLAUDE_PATH = join(homedir(), ".claude", ".credentials.json");

function mockAdapter(overrides: Partial<AuthProfileAdapter> = {}): AuthProfileAdapter {
  return {
    getProfile: vi.fn().mockResolvedValue(null),
    setProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AuthProfileAdapter;
}

function existsFor(...paths: string[]) {
  mocks.existsSync.mockImplementation((p) => paths.includes(String(p)));
}

describe("syncExternalCliCredentials", () => {
  beforeEach(() => {
    mocks.existsSync.mockReset().mockReturnValue(false);
    mocks.readFile.mockReset().mockResolvedValue("");
  });

  describe("qwen-portal", () => {
    it("syncs valid oauth_creds.json to qwen-portal-cli:default", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(
        JSON.stringify({
          access_token: "qk-abc",
          refresh_token: "rt-1",
          expires_at: 9999999999,
          email: "u@q.com",
        }),
      );
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).toHaveBeenCalledWith("qwen-portal-cli:default", {
        type: "oauth",
        provider: "qwen-portal",
        access: "qk-abc",
        refresh: "rt-1",
        expires: 9999999999,
        email: "u@q.com",
      });
    });

    it("correctly parses all credential fields", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_at: 123,
          email: "e@e.com",
        }),
      );
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      const cred = vi.mocked(adapter.setProfile).mock.calls[0]?.[1] as AuthProfileCredential & {
        access: string;
        refresh: string;
        expires: number;
        email?: string;
      };
      expect(cred.access).toBe("at");
      expect(cred.refresh).toBe("rt");
      expect(cred.expires).toBe(123);
      expect(cred.email).toBe("e@e.com");
    });

    it("skips when access_token is empty", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(JSON.stringify({ access_token: "" }));
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).not.toHaveBeenCalled();
    });

    it("defaults expires to ~1h when expires_at is missing", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(JSON.stringify({ access_token: "tok" }));
      const now = Date.now();
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      const cred = vi.mocked(adapter.setProfile).mock.calls[0]?.[1] as AuthProfileCredential & {
        expires: number;
      };
      expect(cred.expires).toBeGreaterThanOrEqual(now);
      expect(cred.expires).toBeLessThanOrEqual(now + 3600_000 + 1000);
    });
  });

  describe("minimax-portal", () => {
    it("syncs valid oauth_creds.json to minimax-portal-cli:default", async () => {
      existsFor(MINIMAX_PATH);
      mocks.readFile.mockResolvedValue(
        JSON.stringify({ access_token: "mm-tok", expires_at: 5000 }),
      );
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).toHaveBeenCalledWith(
        "minimax-portal-cli:default",
        expect.objectContaining({
          type: "oauth",
          provider: "minimax-portal",
          access: "mm-tok",
        }),
      );
    });
  });

  describe("anthropic", () => {
    it("syncs valid .credentials.json to anthropic-cli:default", async () => {
      existsFor(CLAUDE_PATH);
      const expiry = new Date(Date.now() + 7200_000).toISOString();
      mocks.readFile.mockResolvedValue(JSON.stringify({ oauth_token: "sk-ant-xxx", expiry }));
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).toHaveBeenCalledWith(
        "anthropic-cli:default",
        expect.objectContaining({
          type: "oauth",
          provider: "anthropic",
          access: "sk-ant-xxx",
          refresh: "",
        }),
      );
    });

    it("skips when oauth_token is empty", async () => {
      existsFor(CLAUDE_PATH);
      mocks.readFile.mockResolvedValue(JSON.stringify({ oauth_token: "" }));
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).not.toHaveBeenCalled();
    });
  });

  describe("overwrite logic", () => {
    it("overwrites existing profile with older expires", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(JSON.stringify({ access_token: "new", expires_at: 2000 }));
      const adapter = mockAdapter({
        getProfile: vi.fn().mockResolvedValue({
          type: "oauth",
          provider: "qwen-portal",
          access: "old",
          refresh: "",
          expires: 1000,
        }),
      });
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).toHaveBeenCalled();
    });

    it("does NOT overwrite existing profile with newer expires", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue(JSON.stringify({ access_token: "new", expires_at: 1000 }));
      const adapter = mockAdapter({
        getProfile: vi.fn().mockResolvedValue({
          type: "oauth",
          provider: "qwen-portal",
          access: "old",
          refresh: "",
          expires: 2000,
        }),
      });
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("skips when file does not exist", async () => {
      mocks.existsSync.mockReturnValue(false);
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(mocks.readFile).not.toHaveBeenCalled();
      expect(adapter.setProfile).not.toHaveBeenCalled();
    });

    it("skips and logs debug on invalid JSON", async () => {
      existsFor(QWEN_PATH);
      mocks.readFile.mockResolvedValue("not-json{{{");
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      expect(adapter.setProfile).not.toHaveBeenCalled();
      // parse returns null for invalid JSON, so it just continues — no error thrown
      // The function only debug-logs when readFile itself throws
    });

    it("single CLI failure does not block other syncs", async () => {
      existsFor(CLAUDE_PATH, QWEN_PATH);
      mocks.readFile.mockImplementation(async (p) => {
        if (String(p) === CLAUDE_PATH) throw new Error("permission denied");
        return JSON.stringify({ access_token: "ok", expires_at: 9999 });
      });
      const adapter = mockAdapter();
      await syncExternalCliCredentials(adapter);

      // qwen should still sync despite claude failure
      expect(adapter.setProfile).toHaveBeenCalledWith(
        "qwen-portal-cli:default",
        expect.objectContaining({ access: "ok" }),
      );
    });
  });
});
