import { describe, expect, it } from "vitest";
import { formatSecondsFromMs, outputToText, summarizeOutputText } from "../execDisplay";

describe("execDisplay", () => {
  it("should format duration from milliseconds", () => {
    expect(formatSecondsFromMs(0)).toBe(0);
    expect(formatSecondsFromMs(1499)).toBe(1);
    expect(formatSecondsFromMs(2501)).toBe(3);
  });

  it("should convert output into readable text", () => {
    expect(outputToText("hello")).toBe("hello");
    expect(outputToText({ ok: true })).toContain('"ok": true');
  });

  it("should summarize long output with truncation mark", () => {
    const input = ["line1", "line2", "line3", "line4", "line5"].join("\n");
    const { preview, truncated } = summarizeOutputText(input, { maxLines: 3, maxChars: 1000 });
    expect(truncated).toBe(true);
    expect(preview).toContain("line1");
    expect(preview).toContain("line3");
    expect(preview.endsWith("…")).toBe(true);
  });
});
