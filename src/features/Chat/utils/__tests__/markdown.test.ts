import { describe, expect, it } from "vitest";
import { stripTerminalControlSequences } from "../markdown";

describe("stripTerminalControlSequences", () => {
  it("removes ansi csi control sequences", () => {
    expect(stripTerminalControlSequences("hello\u001b[?25h world")).toBe("hello world");
  });

  it("removes leaked csi fragment without ESC", () => {
    expect(stripTerminalControlSequences("plugins available [?25h")).toBe("plugins available ");
  });

  it("keeps normal markdown link text", () => {
    expect(stripTerminalControlSequences("[OpenClaw](https://docs.openclaw.ai)")).toBe(
      "[OpenClaw](https://docs.openclaw.ai)",
    );
  });
});
