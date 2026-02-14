import { describe, expect, it } from "vitest";
import { extractToolCallId, readToolEventText } from "../events";

describe("readToolEventText", () => {
  it("returns null for end phase without result payload", () => {
    expect(
      readToolEventText({
        name: "exec",
        phase: "end",
      }),
    ).toBeNull();
  });

  it("extracts text from end phase when payload includes result", () => {
    expect(
      readToolEventText({
        name: "exec",
        phase: "end",
        result: {
          message: "done",
        },
      }),
    ).toBe("done");
  });

  it("returns failed text for explicit tool errors", () => {
    expect(
      readToolEventText({
        name: "exec",
        phase: "error",
        result: {
          error: "permission denied",
        },
      }),
    ).toBe("Exec failed: permission denied");
  });
});

describe("extractToolCallId", () => {
  it("reads toolCallId aliases", () => {
    expect(extractToolCallId({ toolCallId: "tc-1" })).toBe("tc-1");
    expect(extractToolCallId({ tool_call_id: "tc-2" })).toBe("tc-2");
    expect(extractToolCallId({ toolUseId: "tc-3" })).toBe("tc-3");
    expect(extractToolCallId({ tool_use_id: "tc-4" })).toBe("tc-4");
  });

  it("returns empty string when payload does not contain tool call id", () => {
    expect(extractToolCallId({ name: "exec", phase: "result" })).toBe("");
    expect(extractToolCallId(null)).toBe("");
  });
});
