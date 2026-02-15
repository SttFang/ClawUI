import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { WorkspaceFileList } from "../WorkspaceFileList";

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("WorkspaceFileList", () => {
  beforeEach(() => {
    useWorkspaceFilesStore.setState({
      files: [],
      currentPath: "",
      openTabs: [],
      activeTabPath: null,
      loading: false,
      error: null,
      pythonResult: null,
      pythonRunning: false,
    });
  });

  it("should auto collapse when root workspace has no files", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(WorkspaceFileList));
      await Promise.resolve();
    });

    const collapsibleRoot = container.querySelector("div.border-t[data-state]");
    expect(collapsibleRoot?.getAttribute("data-state")).toBe("closed");

    act(() => {
      root.unmount();
    });
  });
});
