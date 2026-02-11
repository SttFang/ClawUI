import { describe, expect, it } from "vitest";
import { deepMergeDraft, setDraftPath } from "../draftObject";

describe("draftObject helpers", () => {
  it("deepMergeDraft merges nested object fields", () => {
    const target = {
      tools: {
        allow: ["fs"],
        exec: { ask: "on-miss" },
      },
    };
    const patch = {
      tools: {
        deny: ["exec"],
      },
    };

    const merged = deepMergeDraft(target, patch);
    expect(merged).toEqual({
      tools: {
        allow: ["fs"],
        deny: ["exec"],
        exec: { ask: "on-miss" },
      },
    });
  });

  it("setDraftPath creates missing objects and sets value", () => {
    const input = { channels: {} };
    const next = setDraftPath(input, ["channels", "telegram", "enabled"], true);
    expect(next).toEqual({
      channels: {
        telegram: {
          enabled: true,
        },
      },
    });
  });
});
