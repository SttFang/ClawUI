import type { ModelsStatus } from "@clawui/types/models";
import { describe, expect, it } from "vitest";
import {
  buildProviderEnvPatch,
  canSaveApiKeyForProvider,
  readApiKeysFromEnv,
} from "../providerConfigMiddleware";

describe("providerConfigMiddleware", () => {
  it("reads known provider keys from env", () => {
    const keys = readApiKeysFromEnv({
      OPENAI_API_KEY: "sk-openai",
      GEMINI_API_KEY: "sk-gemini",
    });
    expect(keys.openai).toBe("sk-openai");
    expect(keys.google).toBe("sk-gemini");
  });

  it("builds provider scoped patch", () => {
    const patch = buildProviderEnvPatch({
      apiKeys: { google: "sk-gemini" },
      modelsStatus: null,
      providerId: "google",
    });
    expect(patch).toEqual({ GEMINI_API_KEY: "sk-gemini" });
  });

  it("supports dynamic env key from models status", () => {
    const modelsStatus = {
      defaultModel: "custom/model",
      fallbacks: [],
      auth: {
        providers: [
          {
            provider: "custom-provider",
            effective: { kind: "env", detail: "masked" },
            env: { source: "env: CUSTOM_PROVIDER_API_KEY" },
          },
        ],
      },
    } as unknown as ModelsStatus;

    const patch = buildProviderEnvPatch({
      apiKeys: { "custom-provider": "sk-custom" },
      modelsStatus,
      providerId: "custom-provider",
    });
    expect(patch).toEqual({ CUSTOM_PROVIDER_API_KEY: "sk-custom" });
  });

  it("rejects unsupported provider in provider-scoped save", () => {
    expect(() =>
      buildProviderEnvPatch({
        apiKeys: { "unknown-provider": "sk-unknown" },
        modelsStatus: null,
        providerId: "unknown-provider",
      }),
    ).toThrowError('Provider "unknown-provider" does not support API key persistence.');
  });

  it("canSaveApiKeyForProvider follows env mapping", () => {
    expect(canSaveApiKeyForProvider({ providerId: "google", modelsStatus: null })).toBe(true);
    expect(canSaveApiKeyForProvider({ providerId: "openai-codex", modelsStatus: null })).toBe(
      false,
    );
  });
});
