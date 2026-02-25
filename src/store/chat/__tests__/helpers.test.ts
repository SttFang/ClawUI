import { describe, expect, it } from "vitest";
import { isSubagentSessionKey, parseSessionsListPayload } from "../helpers";

describe("isSubagentSessionKey", () => {
  it("returns true for subagent session keys", () => {
    expect(isSubagentSessionKey("agent:main:subagent:abc-123")).toBe(true);
  });

  it("returns false for main session key", () => {
    expect(isSubagentSessionKey("agent:main:main")).toBe(false);
  });

  it("returns false for UI session key", () => {
    expect(isSubagentSessionKey("agent:main:ui:abc")).toBe(false);
  });
});

describe("parseSessionsListPayload", () => {
  it("filters out subagent sessions", () => {
    const payload = {
      sessions: [
        { key: "agent:main:main", derivedTitle: "Main", updatedAt: 100 },
        { key: "agent:main:subagent:abc-123", derivedTitle: "Sub", updatedAt: 200 },
        { key: "agent:main:ui:xyz", derivedTitle: "UI", updatedAt: 50 },
      ],
    };
    const result = parseSessionsListPayload(payload);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["agent:main:main", "agent:main:ui:xyz"]);
  });

  it("returns empty array for invalid payload", () => {
    expect(parseSessionsListPayload(null)).toEqual([]);
    expect(parseSessionsListPayload({})).toEqual([]);
    expect(parseSessionsListPayload({ sessions: "not-array" })).toEqual([]);
  });

  it("strips inbound-meta sentinels and JSON body from derivedTitle", () => {
    const payload = {
      sessions: [
        {
          key: "agent:main:discord:123",
          derivedTitle:
            'Conversation info (untrusted metadata):\n```json\n{"sender":"user","message_id":"abc"}',
          updatedAt: 1000,
        },
      ],
    };
    const result = parseSessionsListPayload(payload);
    // Entire metadata block stripped → falls back to key
    expect(result[0].name).toBe("agent:main:discord:123");
  });

  it("strips various inbound-meta sentinel prefixes", () => {
    const cases: [string, string][] = [
      ["Sender (untrusted metadata): hello", "hello"],
      ["Thread starter (untrusted, for context): hello", "hello"],
      ["Replied message (untrusted, for context): hello", "hello"],
      ["Chat history since last reply (untrusted, for context): hello", "hello"],
    ];
    for (const [title, expected] of cases) {
      const result = parseSessionsListPayload({
        sessions: [{ key: "s1", derivedTitle: title, updatedAt: 1 }],
      });
      expect(result[0].name).toBe(expected);
    }
  });

  it("preserves normal titles unchanged", () => {
    const result = parseSessionsListPayload({
      sessions: [{ key: "s1", derivedTitle: "My Chat", updatedAt: 1 }],
    });
    expect(result[0].name).toBe("My Chat");
  });
});
