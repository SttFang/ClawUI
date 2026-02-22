import type { ProviderAuthInfo } from "@clawui/types/models";
import { describe, expect, it } from "vitest";
import {
  extractEnvVarFromSource,
  getProviderOAuthMethod,
  normalizeProviderId,
  resolveProviderEnvKey,
} from "../providerRegistry";

describe("providerRegistry", () => {
  it("normalizes aliases", () => {
    expect(normalizeProviderId("z.ai")).toBe("zai");
    expect(normalizeProviderId("bedrock")).toBe("amazon-bedrock");
    expect(normalizeProviderId(" openai ")).toBe("openai");
  });

  it("extracts env key from auth source first", () => {
    const authInfo = {
      provider: "google",
      effective: { kind: "env", detail: "masked" },
      env: { source: "env: GEMINI_API_KEY" },
    } as ProviderAuthInfo & { env: { source: string } };

    expect(
      resolveProviderEnvKey({
        providerId: "google",
        authInfo,
      }),
    ).toBe("GEMINI_API_KEY");
  });

  it("parses env source label", () => {
    expect(extractEnvVarFromSource("shell env: OPENROUTER_API_KEY")).toBe("OPENROUTER_API_KEY");
    expect(extractEnvVarFromSource("env: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY")).toBe(
      "AWS_ACCESS_KEY_ID",
    );
  });

  describe("oauthMethod classification", () => {
    it("github-copilot → device-code", () => {
      expect(getProviderOAuthMethod("github-copilot")).toBe("device-code");
    });

    it("qwen-portal → external-cli", () => {
      expect(getProviderOAuthMethod("qwen-portal")).toBe("external-cli");
    });

    it("minimax-portal → external-cli", () => {
      expect(getProviderOAuthMethod("minimax-portal")).toBe("external-cli");
    });

    it("anthropic → external-cli", () => {
      expect(getProviderOAuthMethod("anthropic")).toBe("external-cli");
    });

    it("openai → undefined", () => {
      expect(getProviderOAuthMethod("openai")).toBeUndefined();
    });

    it("unknown provider → undefined", () => {
      expect(getProviderOAuthMethod("nonexistent-provider")).toBeUndefined();
    });
  });
});
