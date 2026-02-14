import type { DynamicToolUIPart } from "ai";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ToolEventCard } from "../ToolEventCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

describe("ToolEventCard", () => {
  it("renders read string output as plain text and avoids DOM nesting warnings", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "read",
      toolCallId: "call_I0juQg9HZ0gB68z8TTSMdvQy|fc_0c57b44d",
      state: "output-available",
      providerExecuted: true,
      input: { path: "/tmp/1.png" },
      output: "Read image file [image/png]",
    } as DynamicToolUIPart;

    const container = document.createElement("div");
    const root = createRoot(container);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      act(() => {
        root.render(createElement(ToolEventCard, { part, sessionKey: "s1" }));
      });
      expect(container.textContent).toContain("Read image file [image/png]");
      expect(container.textContent).not.toContain('"Read image file [image/png]"');

      const nestingErrors = consoleErrorSpy.mock.calls.filter(([message]) =>
        String(message).includes("validateDOMNesting"),
      );
      expect(nestingErrors).toHaveLength(0);
    } finally {
      act(() => {
        root.unmount();
      });
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders read compact mode with truncated preview and toggle", () => {
    const longOutput = "A".repeat(1200);
    const part = {
      type: "dynamic-tool",
      toolName: "read",
      toolCallId: "tool-read-compact-1",
      state: "output-available",
      providerExecuted: true,
      input: { path: "/tmp/long.txt" },
      output: longOutput,
    } as DynamicToolUIPart;

    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          createElement(ToolEventCard, {
            part,
            sessionKey: "s1",
            renderMode: "read_compact",
            maxPreviewChars: 80,
          }),
        );
      });
      expect(container.textContent).toContain("a2ui.execAction.viewFullOutput");
      expect(container.textContent).toContain("...");
      expect(container.textContent).not.toContain(longOutput);

      const toggle = container.querySelector("button");
      expect(toggle).not.toBeNull();
      act(() => {
        toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.textContent).toContain("a2ui.execAction.hideFullOutput");
      expect(container.textContent).toContain(longOutput);
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });

  it("renders generic tool without errors", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "search",
      toolCallId: "tool-search-1",
      state: "input-available",
      providerExecuted: true,
      input: { query: "hello world" },
    } as DynamicToolUIPart;

    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      act(() => {
        root.render(createElement(ToolEventCard, { part, sessionKey: "s1" }));
      });
      expect(container.textContent).toContain("search");
      expect(container.textContent).toContain("hello world");
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });
});
