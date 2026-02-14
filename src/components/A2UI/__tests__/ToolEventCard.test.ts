import type { DynamicToolUIPart } from "ai";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeExecApprovalKey } from "@/store/execApprovals";
import { EXEC_RUNNING_TTL_MS } from "@/store/execApprovals/helpers";
import { initialState as execApprovalsInitialState } from "@/store/execApprovals/initialState";
import { useExecApprovalsStore } from "@/store/execApprovals/store";
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
  beforeEach(() => {
    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
  });

  it("does not trigger maximum update depth with exec approval state", () => {
    const sessionKey = "agent:main:ui:tool-event-card";
    const command = "ls -la";
    const now = Date.now();
    const runningKey = makeExecApprovalKey(sessionKey, command);

    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [
        {
          id: "approval-1",
          request: {
            command,
            sessionKey,
          },
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        },
      ],
      busyById: {},
      runningByKey: {
        [runningKey]: now,
      },
      lastResolvedBySession: {},
    });

    const part = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-exec-1",
      state: "input-available",
      providerExecuted: true,
      input: { command },
    } as DynamicToolUIPart;

    const container = document.createElement("div");
    const root = createRoot(container);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      act(() => {
        root.render(createElement(ToolEventCard, { part, sessionKey }));
      });
      act(() => {
        root.render(createElement(ToolEventCard, { part, sessionKey }));
      });

      const depthErrors = consoleErrorSpy.mock.calls.filter(([message]) =>
        String(message).includes("Maximum update depth exceeded"),
      );
      expect(depthErrors).toHaveLength(0);
    } finally {
      act(() => {
        root.unmount();
      });
      consoleErrorSpy.mockRestore();
    }
  });

  it("treats bash as exec-like and expires running status after TTL", () => {
    vi.useFakeTimers();
    const sessionKey = "agent:main:ui:tool-event-card-bash";
    const command = "ls -la ~/Desktop";
    const now = Date.now();
    const runningKey = makeExecApprovalKey(sessionKey, command);

    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [],
      busyById: {},
      runningByKey: {
        [runningKey]: now,
      },
      lastResolvedBySession: {},
    });

    const part = {
      type: "dynamic-tool",
      toolName: "bash",
      toolCallId: "tool-bash-1",
      state: "input-available",
      providerExecuted: true,
      input: { command },
    } as DynamicToolUIPart;

    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      act(() => {
        root.render(createElement(ToolEventCard, { part, sessionKey }));
      });
      expect(container.textContent).toContain("a2ui.toolState.running");

      act(() => {
        vi.advanceTimersByTime(EXEC_RUNNING_TTL_MS + 2_000);
      });
      expect(container.textContent).toContain("input-available");
    } finally {
      act(() => {
        root.unmount();
      });
      vi.useRealTimers();
    }
  });
});
