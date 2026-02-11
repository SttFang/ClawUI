import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { buildHistoryFingerprint } from "../historyFingerprint";

function textMessage(id: string, role: UIMessage["role"], text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("buildHistoryFingerprint", () => {
  it("detects changes outside the last two messages", () => {
    const before = [
      textMessage("u1", "user", "hi"),
      textMessage("a1", "assistant", "old response"),
      textMessage("s1", "system", "approval pending"),
      textMessage("a2", "assistant", "tail response"),
    ];
    const after = [
      textMessage("u1", "user", "hi"),
      textMessage("a1", "assistant", "new response after approval"),
      textMessage("s1", "system", "approval pending"),
      textMessage("a2", "assistant", "tail response"),
    ];

    expect(buildHistoryFingerprint(after)).not.toBe(buildHistoryFingerprint(before));
  });

  it("detects dynamic-tool output changes even when output length is unchanged", () => {
    const base: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "exec-1",
          toolName: "exec",
          state: "output-available",
          input: { command: "echo foo" },
          output: "abc",
          providerExecuted: true,
        },
      ],
    };
    const changed: UIMessage = {
      ...base,
      parts: [
        {
          ...(base.parts[0] as Record<string, unknown>),
          output: "xyz",
        } as UIMessage["parts"][number],
      ],
    };

    expect(buildHistoryFingerprint([changed])).not.toBe(buildHistoryFingerprint([base]));
  });

  it("keeps fingerprint stable for identical messages", () => {
    const messages = [textMessage("u1", "user", "hi"), textMessage("a1", "assistant", "hello")];

    expect(buildHistoryFingerprint(messages)).toBe(buildHistoryFingerprint(messages));
  });
});
