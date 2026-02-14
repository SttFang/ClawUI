import { describe, expect, it } from "vitest";
import { readToolEventText } from "../events";

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
