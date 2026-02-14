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

  // --- Gateway tools ---

  it("web_fetch with url → fetch hostname", () => {
    expect(buildToolSummary(fakePart("web_fetch", { url: "https://api.example.com/v1" }))).toBe(
      "fetch api.example.com",
    );
  });

  it("memory_search with query → memory search quote", () => {
    expect(buildToolSummary(fakePart("memory_search", { query: "user preferences" }))).toBe(
      'memory search "user preferences"',
    );
  });

  it("memory_get with key → memory get quote", () => {
    expect(buildToolSummary(fakePart("memory_get", { key: "theme" }))).toBe('memory get "theme"');
  });

  it("agents_list → list agents", () => {
    expect(buildToolSummary(fakePart("agents_list", {}))).toBe("list agents");
  });

  it("cron with action and name", () => {
    expect(buildToolSummary(fakePart("cron", { action: "list" }))).toBe("cron list");
    expect(buildToolSummary(fakePart("cron", { action: "create", name: "backup" }))).toBe(
      'cron create "backup"',
    );
  });

  it("nodes with action", () => {
    expect(buildToolSummary(fakePart("nodes", { action: "camera" }))).toBe("nodes camera");
    expect(buildToolSummary(fakePart("nodes", {}))).toBe("nodes");
  });

  it("canvas with action", () => {
    expect(buildToolSummary(fakePart("canvas", { action: "draw" }))).toBe("canvas draw");
  });

  it("gateway with action", () => {
    expect(buildToolSummary(fakePart("gateway", { action: "restart" }))).toBe("gateway restart");
  });

  it("message with to", () => {
    expect(buildToolSummary(fakePart("message", { to: "#general" }))).toBe("message #general");
  });

  it("image with prompt", () => {
    expect(buildToolSummary(fakePart("image", { prompt: "a cat" }))).toBe('image "a cat"');
  });

  it("tts with text", () => {
    expect(buildToolSummary(fakePart("tts", { text: "hello world" }))).toBe('tts "hello world"');
  });

  it("sessions_send with sessionKey", () => {
    expect(buildToolSummary(fakePart("sessions_send", { sessionKey: "abc" }))).toBe("send to abc");
  });

  it("sessions_spawn with prompt", () => {
    expect(buildToolSummary(fakePart("sessions_spawn", { prompt: "do stuff" }))).toBe(
      'spawn "do stuff"',
    );
  });

  // --- generic fallback ---

  it("unknown tool with action field → display name + action", () => {
    expect(buildToolSummary(fakePart("some_custom_tool", { action: "do_stuff" }))).toBe(
      "some custom tool do_stuff",
    );
  });

  it("unknown tool with empty input → display name only", () => {
    expect(buildToolSummary(fakePart("some_custom_tool", {}))).toBe("some custom tool");
  });

  it("unknown tool with long value → truncated to 30 chars", () => {
    const longVal = "a".repeat(50);
    const result = buildToolSummary(fakePart("my_tool", { command: longVal }));
    expect(result).toBe(`my tool ${"a".repeat(30)}…`);
  });
});
