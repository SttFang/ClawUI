import { describe, expect, it } from "vitest";
import {
  compactTableLeadingBlankLines,
  shouldParseIncompleteMarkdown,
  stripTerminalControlSequences,
} from "../markdown";

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

describe("shouldParseIncompleteMarkdown", () => {
  it("returns true for incomplete markdown links", () => {
    expect(shouldParseIncompleteMarkdown("[OpenClaw](https://docs.openclaw.ai")).toBe(true);
  });

  it("returns false for complete markdown links", () => {
    expect(shouldParseIncompleteMarkdown("[OpenClaw](https://docs.openclaw.ai)")).toBe(false);
  });
});

describe("compactTableLeadingBlankLines", () => {
  it("compacts excessive blank lines before a markdown table", () => {
    const text = [
      "记录如下：",
      "",
      "",
      "",
      "| 点号 | x | y |",
      "| --- | --- | --- |",
      "| 1 | 0.0 | 1.2 |",
    ].join("\n");

    expect(compactTableLeadingBlankLines(text)).toBe(
      ["记录如下：", "", "| 点号 | x | y |", "| --- | --- | --- |", "| 1 | 0.0 | 1.2 |"].join("\n"),
    );
  });

  it("keeps non-table content unchanged", () => {
    const text = "第一段\n\n\n\n第二段";
    expect(compactTableLeadingBlankLines(text)).toBe(text);
  });
});
