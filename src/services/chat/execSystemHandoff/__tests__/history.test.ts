import { describe, expect, it } from "vitest";
import { pickLastHistoryText } from "../history";

describe("pickLastHistoryText with toolCallId", () => {
  it("prefers matched toolCallId entry", () => {
    const messages = [
      {
        id: "m1",
        sessionKey: "s1",
        role: "system",
        createdAtMs: 1000,
        toolCallId: "tc-1",
        content: [{ type: "text", text: "result-1" }],
      },
      {
        id: "m2",
        sessionKey: "s1",
        role: "system",
        createdAtMs: 2000,
        toolCallId: "tc-2",
        content: [{ type: "text", text: "result-2" }],
      },
    ];

    const text = pickLastHistoryText({
      messages,
      sessionKey: "s1",
      toolCallId: "tc-1",
      requireToolCallIdMatch: true,
    });

    expect(text).toBe("result-1");
  });

  it("returns null when requireToolCallIdMatch is enabled and id does not match", () => {
    const messages = [
      {
        id: "m3",
        sessionKey: "s1",
        role: "system",
        createdAtMs: 3000,
        toolCallId: "tc-3",
        content: [{ type: "text", text: "result-3" }],
      },
    ];

    const text = pickLastHistoryText({
      messages,
      sessionKey: "s1",
      toolCallId: "tc-missing",
      requireToolCallIdMatch: true,
    });

    expect(text).toBeNull();
  });
});
