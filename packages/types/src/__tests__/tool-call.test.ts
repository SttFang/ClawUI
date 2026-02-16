import { describe, expect, it } from "vitest";
import {
  TOOL_CALL_STATE_PRIORITY,
  isHigherOrEqualPriority,
  isInputState,
  isOutputState,
  isSyntheticToolCallId,
  normalizeToolCallId,
  resolveToolCallId,
  toolStatePriority,
} from "../tool-call";

describe("normalizeToolCallId", () => {
  it("returns trimmed value for simple IDs", () => {
    expect(normalizeToolCallId("call_abc123")).toBe("call_abc123");
    expect(normalizeToolCallId("  call_abc123  ")).toBe("call_abc123");
  });

  it("strips pipe suffix when primary starts with call_", () => {
    expect(normalizeToolCallId("call_abc123|extra-info")).toBe("call_abc123");
    expect(normalizeToolCallId("call_x|y|z")).toBe("call_x");
  });

  it("keeps full value when primary does not start with call_", () => {
    expect(normalizeToolCallId("toolu_abc|extra")).toBe("toolu_abc|extra");
    expect(normalizeToolCallId("some-id|meta")).toBe("some-id|meta");
  });

  it("handles empty and whitespace-only values", () => {
    expect(normalizeToolCallId("")).toBe("");
    expect(normalizeToolCallId("   ")).toBe("");
  });

  it("returns full value when separator is at position 0", () => {
    expect(normalizeToolCallId("|leading-pipe")).toBe("|leading-pipe");
  });
});

describe("resolveToolCallId", () => {
  it("returns empty string for null record", () => {
    expect(resolveToolCallId(null)).toBe("");
  });

  it("returns empty string when no candidates match", () => {
    expect(resolveToolCallId({ foo: "bar" })).toBe("");
    expect(resolveToolCallId({})).toBe("");
  });

  it("resolves from toolCallId first", () => {
    expect(
      resolveToolCallId({ toolCallId: "call_a", tool_call_id: "call_b" }),
    ).toBe("call_a");
  });

  it("falls back through candidate fields in order", () => {
    expect(resolveToolCallId({ tool_call_id: "call_b" })).toBe("call_b");
    expect(resolveToolCallId({ toolUseId: "toolu_c" })).toBe("toolu_c");
    expect(resolveToolCallId({ tool_use_id: "toolu_d" })).toBe("toolu_d");
    expect(resolveToolCallId({ toolId: "tid" })).toBe("tid");
    expect(resolveToolCallId({ id: "some-id" })).toBe("some-id");
  });

  it("normalizes the resolved value", () => {
    expect(resolveToolCallId({ toolCallId: "call_abc|extra" })).toBe(
      "call_abc",
    );
  });

  it("skips empty string candidates", () => {
    expect(
      resolveToolCallId({ toolCallId: "", tool_call_id: "call_real" }),
    ).toBe("call_real");
    expect(resolveToolCallId({ toolCallId: "   ", id: "fallback" })).toBe(
      "fallback",
    );
  });
});

describe("isSyntheticToolCallId", () => {
  it("returns true for empty/whitespace values", () => {
    expect(isSyntheticToolCallId("")).toBe(true);
    expect(isSyntheticToolCallId("  ")).toBe(true);
  });

  it("returns true for :tool suffix", () => {
    expect(isSyntheticToolCallId("msg123:tool")).toBe(true);
  });

  it("returns true for :tool- infix", () => {
    expect(isSyntheticToolCallId("msg123:tool-2")).toBe(true);
  });

  it("returns true for assistant: or system: prefix", () => {
    expect(isSyntheticToolCallId("assistant:42:hash")).toBe(true);
    expect(isSyntheticToolCallId("system:0:hash")).toBe(true);
  });

  it("returns false for real provider IDs", () => {
    expect(isSyntheticToolCallId("call_abc123")).toBe(false);
    expect(isSyntheticToolCallId("toolu_xyz")).toBe(false);
  });
});

describe("isInputState / isOutputState", () => {
  it("isInputState recognizes input states", () => {
    expect(isInputState("input-available")).toBe(true);
    expect(isInputState("input-streaming")).toBe(true);
    expect(isInputState("output-available")).toBe(false);
    expect(isInputState("output-error")).toBe(false);
    expect(isInputState(undefined)).toBe(false);
  });

  it("isOutputState recognizes output states", () => {
    expect(isOutputState("output-available")).toBe(true);
    expect(isOutputState("output-error")).toBe(true);
    expect(isOutputState("input-available")).toBe(false);
    expect(isOutputState("input-streaming")).toBe(false);
  });
});

describe("toolStatePriority", () => {
  it("returns correct priority values", () => {
    expect(toolStatePriority("input-available")).toBe(1);
    expect(toolStatePriority("input-streaming")).toBe(2);
    expect(toolStatePriority("output-available")).toBe(3);
    expect(toolStatePriority("output-error")).toBe(4);
  });

  it("returns 0 for unknown states", () => {
    expect(toolStatePriority("unknown")).toBe(0);
    expect(toolStatePriority(null)).toBe(0);
    expect(toolStatePriority(undefined)).toBe(0);
  });
});

describe("TOOL_CALL_STATE_PRIORITY", () => {
  it("has all four states with correct ordering", () => {
    const keys = Object.keys(TOOL_CALL_STATE_PRIORITY);
    expect(keys).toHaveLength(4);
    expect(TOOL_CALL_STATE_PRIORITY["input-available"]).toBeLessThan(
      TOOL_CALL_STATE_PRIORITY["input-streaming"],
    );
    expect(TOOL_CALL_STATE_PRIORITY["input-streaming"]).toBeLessThan(
      TOOL_CALL_STATE_PRIORITY["output-available"],
    );
    expect(TOOL_CALL_STATE_PRIORITY["output-available"]).toBeLessThan(
      TOOL_CALL_STATE_PRIORITY["output-error"],
    );
  });
});

describe("isHigherOrEqualPriority", () => {
  it("returns true when incoming >= current", () => {
    expect(isHigherOrEqualPriority("output-available", "input-available")).toBe(
      true,
    );
    expect(
      isHigherOrEqualPriority("output-available", "output-available"),
    ).toBe(true);
    expect(isHigherOrEqualPriority("output-error", "output-available")).toBe(
      true,
    );
  });

  it("returns false when incoming < current", () => {
    expect(isHigherOrEqualPriority("input-available", "output-available")).toBe(
      false,
    );
  });
});
