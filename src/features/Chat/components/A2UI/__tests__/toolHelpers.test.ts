import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";
import { buildToolSummary } from "../toolHelpers";

function fakePart(toolName: string, input: unknown): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolName,
    toolCallId: "tc-test",
    state: "input-available",
    input,
    providerExecuted: false,
  };
}

describe("buildToolSummary", () => {
  it("browser navigate with URL → browse hostname", () => {
    expect(
      buildToolSummary(
        fakePart("browser", { action: "navigate", targetUrl: "https://example.com/path" }),
      ),
    ).toBe("browse example.com");
  });

  it("browser act click → browser click", () => {
    expect(
      buildToolSummary(
        fakePart("browser", { action: "act", request: { kind: "click", ref: "#btn" } }),
      ),
    ).toBe("browser click");
  });

  it("browser screenshot → browser screenshot", () => {
    expect(buildToolSummary(fakePart("browser", { action: "screenshot" }))).toBe(
      "browser screenshot",
    );
  });

  it("browser no action → browser", () => {
    expect(buildToolSummary(fakePart("browser", {}))).toBe("browser");
  });

  it("web_search with query → search quote", () => {
    expect(buildToolSummary(fakePart("web_search", { query: "AI news" }))).toBe('search "AI news"');
  });

  it("fetch with url → fetch hostname", () => {
    expect(buildToolSummary(fakePart("fetch", { url: "https://example.com/api" }))).toBe(
      "fetch example.com",
    );
  });

  it("navigate with url → navigate hostname", () => {
    expect(buildToolSummary(fakePart("navigate", { url: "https://docs.rs/foo" }))).toBe(
      "navigate docs.rs",
    );
  });

  it("browser open with URL → browse hostname", () => {
    expect(
      buildToolSummary(
        fakePart("browser", { action: "open", targetUrl: "https://news.google.com" }),
      ),
    ).toBe("browse news.google.com");
  });

  it("browser navigate without URL → browser navigate", () => {
    expect(buildToolSummary(fakePart("browser", { action: "navigate" }))).toBe("browser navigate");
  });

  it("web-search (hyphenated) with query → search quote", () => {
    expect(buildToolSummary(fakePart("web-search", { query: "test" }))).toBe('search "test"');
  });
});
