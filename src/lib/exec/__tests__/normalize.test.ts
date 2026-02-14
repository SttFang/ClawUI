import { describe, it, expect } from "vitest";
import {
  normalizeSessionKey,
  normalizeCommand,
  normalizeToolCallId,
  toRecord,
  isRecord,
  makeExecApprovalKey,
} from "../normalize";

describe("toRecord", () => {
  it("returns the object for a plain object", () => {
    const obj = { a: 1 };
    expect(toRecord(obj)).toBe(obj);
  });

  it.each([null, undefined, 42, "string", true])("returns null for %j", (value) => {
    expect(toRecord(value)).toBeNull();
  });
});

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });
});

describe("normalizeSessionKey", () => {
  it("trims whitespace", () => {
    expect(normalizeSessionKey("  abc  ")).toBe("abc");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeSessionKey(null)).toBe("");
    expect(normalizeSessionKey(undefined)).toBe("");
  });
});

describe("normalizeCommand", () => {
  it("collapses whitespace", () => {
    expect(normalizeCommand("echo   hello\n  world")).toBe("echo hello world");
  });
});

describe("normalizeToolCallId", () => {
  it("returns value as-is when no separator", () => {
    expect(normalizeToolCallId("call_abc123")).toBe("call_abc123");
  });

  it("strips suffix after | when primary starts with call_", () => {
    expect(normalizeToolCallId("call_abc123|extra-info")).toBe("call_abc123");
  });

  it("keeps full value when primary does not start with call_", () => {
    expect(normalizeToolCallId("other|extra")).toBe("other|extra");
  });

  it("handles empty string", () => {
    expect(normalizeToolCallId("")).toBe("");
  });

  it("handles leading separator", () => {
    expect(normalizeToolCallId("|trailing")).toBe("|trailing");
  });
});

describe("makeExecApprovalKey", () => {
  it("combines sessionKey and command", () => {
    expect(makeExecApprovalKey("session1", "ls -la")).toBe("session1::ls -la");
  });

  it("handles null sessionKey", () => {
    expect(makeExecApprovalKey(null, "pwd")).toBe("::pwd");
  });
});
