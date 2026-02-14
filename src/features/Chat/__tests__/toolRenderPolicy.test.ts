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

  it("hides session_status", () => {
    expect(classifyToolRender("session_status").kind).toBe("hidden");
  });

  it("falls back unknown tools to generic", () => {
    expect(classifyToolRender("plugin_custom_tool").kind).toBe("generic");
  });

  it("isExploreToolName guards correctly", () => {
    expect(isExploreToolName("read")).toBe(true);
    expect(isExploreToolName("READ")).toBe(true);
    expect(isExploreToolName("exec")).toBe(false);
    expect(isExploreToolName("custom")).toBe(false);
  });
});
