import { describe, expect, it } from "vitest";
import { EXPLORE_PREVIEW_CHARS, classifyToolRender, isExploreToolName } from "../toolRenderPolicy";

describe("toolRenderPolicy", () => {
  it("maps exec and bash to exec", () => {
    expect(classifyToolRender("exec").kind).toBe("exec");
    expect(classifyToolRender("bash").kind).toBe("exec");
  });

  it("maps read/search/glob/grep/list_dir to explore", () => {
    for (const name of ["read", "search", "glob", "grep", "list_dir"]) {
      const policy = classifyToolRender(name);
      expect(policy.kind).toBe("explore");
      expect(policy.maxPreviewChars).toBe(EXPLORE_PREVIEW_CHARS);
    }
  });

  it.each(["session_status", "sessions_list", "sessions_history"])("hides %s", (name) => {
    expect(classifyToolRender(name).kind).toBe("hidden");
  });

  it("falls back unknown tools to explore", () => {
    expect(classifyToolRender("plugin_custom_tool").kind).toBe("explore");
  });

  it("isExploreToolName guards correctly", () => {
    expect(isExploreToolName("read")).toBe(true);
    expect(isExploreToolName("READ")).toBe(true);
    expect(isExploreToolName("exec")).toBe(false);
    expect(isExploreToolName("custom")).toBe(false);
  });

  it.each(["web_fetch", "memory_search", "memory_get", "agents_list"])(
    "classifies %s as explore",
    (name) => {
      expect(classifyToolRender(name).kind).toBe("explore");
    },
  );

  it.each([
    "cron",
    "nodes",
    "canvas",
    "gateway",
    "image",
    "message",
    "tts",
    "sessions_send",
    "sessions_spawn",
    "write",
    "edit",
    "apply_patch",
    "process",
  ])("classifies %s as explore", (name) => {
    expect(classifyToolRender(name).kind).toBe("explore");
  });

  it("is case-insensitive", () => {
    expect(classifyToolRender("WEB_FETCH").kind).toBe("explore");
    expect(classifyToolRender("Memory_Search").kind).toBe("explore");
    expect(classifyToolRender("SESSION_STATUS").kind).toBe("hidden");
  });
});
