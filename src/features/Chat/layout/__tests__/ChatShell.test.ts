import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHAT_LAYOUT_SIZES, ChatShell } from "../ChatShell";

describe("CHAT_LAYOUT_SIZES", () => {
  it("should keep default/max panel sizes in percentage units", () => {
    expect(CHAT_LAYOUT_SIZES.sidebar.defaultSize).toBe("20%");
    expect(CHAT_LAYOUT_SIZES.sidebar.maxSize).toBe("35%");
    expect(CHAT_LAYOUT_SIZES.main.defaultSize).toBe("55%");
    expect(CHAT_LAYOUT_SIZES.filePanel.defaultSize).toBe("25%");
    expect(CHAT_LAYOUT_SIZES.filePanel.maxSize).toBe("50%");
  });

  it("should keep minimum panel sizes in pixel units", () => {
    expect(CHAT_LAYOUT_SIZES.sidebar.minSize).toBe("180px");
    expect(CHAT_LAYOUT_SIZES.main.minSize).toBe("300px");
    expect(CHAT_LAYOUT_SIZES.filePanel.minSize).toBe("240px");
  });

  it("should not render file panel when panel content is missing", () => {
    const html = renderToStaticMarkup(
      createElement(ChatShell, {
        sidebar: createElement("div"),
        main: createElement("div"),
      }),
    );

    expect(html).not.toContain('id="file-panel"');
  });
});
