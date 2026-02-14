import { describe, expect, it } from "vitest";
import { READ_COMPACT_PREVIEW_CHARS, classifyToolRender } from "../toolRenderPolicy";

describe("toolRenderPolicy", () => {
  it("maps exec and bash to exec_card", () => {
    expect(classifyToolRender("exec").kind).toBe("exec_card");
    expect(classifyToolRender("bash").kind).toBe("exec_card");
  });

  it("maps read to read_compact with default preview chars", () => {
    const policy = classifyToolRender("read");
    expect(policy.kind).toBe("read_compact");
    expect(policy.maxPreviewChars).toBe(READ_COMPACT_PREVIEW_CHARS);
  });

  it("hides session_status", () => {
    expect(classifyToolRender("session_status").kind).toBe("hidden");
  });

  it("falls back unknown tools to generic_card", () => {
    expect(classifyToolRender("plugin_custom_tool").kind).toBe("generic_card");
  });
});
