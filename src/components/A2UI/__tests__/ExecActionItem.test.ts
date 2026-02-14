import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { ExecLifecycleRecord } from "@/store/execLifecycle";
import { ExecActionItem } from "../ExecActionItem";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "a2ui.execAction.ranCommand") {
        return `Ran ${String(params?.command ?? "")}`;
      }
      return key;
    },
  }),
}));

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

function createRecord(command: string): ExecLifecycleRecord {
  const now = Date.now();
  return {
    attemptId: "attempt-1",
    lifecycleKey: "run-1::session-1::cmd",
    runId: "run-1",
    sessionKey: "session-1",
    command,
    normalizedCommand: command.trim(),
    status: "completed",
    toolCallId: "tool-1",
    toolName: "exec",
    messageId: "message-1",
    partIndex: 0,
    partState: "output-available",
    preliminary: false,
    startedAtMs: now - 1000,
    updatedAtMs: now,
    sourceToolCallIds: ["tool-1"],
  };
}

describe("ExecActionItem", () => {
  it("shows simplified command title and hides command arguments in body", () => {
    const command =
      "mkdir -p '/Users/fanghanjun/Desktop/激活-教育/03_文档资料/01_方案材料' && cd '/Users/fanghanjun/Desktop/激活-教育/03_文档资料'";
    const record = createRecord(command);
    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      act(() => {
        root.render(createElement(ExecActionItem, { record }));
      });
      const text = container.textContent ?? "";
      expect(text).toContain("Ran Mkdir");
      expect(text).toContain("mkdir");
      expect(text).not.toContain("-p");
      expect(text).not.toContain("/Users/fanghanjun/Desktop");
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });
});
