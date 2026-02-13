import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigTab } from "../ConfigTab";

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

const hoisted = vi.hoisted(() => ({
  loadSchema: vi.fn(async () => {}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/store/configDraft", () => ({
  useConfigDraftStore: (
    selector: ((state: { loadSchema: typeof hoisted.loadSchema }) => unknown) | undefined,
  ) => {
    const state = { loadSchema: hoisted.loadSchema };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

vi.mock("../ChannelsSection", () => ({
  ChannelsSection: () => null,
}));

vi.mock("../ToolsSection", () => ({
  ToolsSection: () => null,
}));

vi.mock("../SkillsSection", () => ({
  SkillsSection: () => null,
}));

vi.mock("../PluginsSection", () => ({
  PluginsSection: () => null,
}));

describe("ConfigTab", () => {
  beforeEach(() => {
    hoisted.loadSchema.mockClear();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
    }
  });

  it("loads config schema once on mount", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/settings?tab=config&section=tools"] },
          createElement(ConfigTab, { activeSection: "tools" }),
        ),
      );
      await Promise.resolve();
    });

    expect(hoisted.loadSchema).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });
});
