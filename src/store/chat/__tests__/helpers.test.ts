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
});
