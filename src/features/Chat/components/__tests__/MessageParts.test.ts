import type { UIMessage } from "ai";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState as execApprovalsInitialState } from "@/store/execApprovals/initialState";
import { useExecApprovalsStore } from "@/store/execApprovals/store";
import { useExecLifecycleStore } from "@/store/execLifecycle";
import { MessageParts } from "../MessageParts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/A2UI", async () => {
  const actual = await vi.importActual<typeof import("@/components/A2UI")>("@/components/A2UI");
  return {
    ...actual,
    ExecActionItem: ({
      record,
    }: {
      record: { lifecycleKey: string; status: string; command: string };
    }) =>
      createElement(
        "div",
        null,
        `exec:${record.lifecycleKey}:${record.status}:${record.command || "<empty>"}`,
      ),
    ToolEventCard: ({
      part,
      renderMode,
    }: {
      part: { toolName: string; toolCallId: string };
      renderMode?: string;
    }) =>
      createElement(
        "div",
        null,
        `tool:${part.toolName}:${part.toolCallId}:${renderMode ?? "generic"}`,
      ),
  };
});

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

describe("MessageParts", () => {
  beforeEach(() => {
    useExecLifecycleStore.getState().reset();
    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
  });

  it("keeps renderer console.error at zero for exec render path", () => {
    const sessionKey = "agent:main:ui:messageparts-console-error-zero";

    const firstMessage: UIMessage = {
      id: "msg-render-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-1",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
        } as const,
      ],
    };
    const secondMessage: UIMessage = {
      id: "msg-render-2",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-2",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
          output: "ok",
        } as const,
      ],
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      act(() => {
        root.render(
          createElement(MessageParts, { message: firstMessage, streaming: false, sessionKey }),
        );
      });
      act(() => {
        root.render(
          createElement(MessageParts, { message: secondMessage, streaming: false, sessionKey }),
        );
      });
      const meaningfulErrors = consoleErrorSpy.mock.calls.filter(([message]) => {
        const text = String(message);
        return !text.includes("ReactDOMTestUtils.act");
      });
      expect(meaningfulErrors).toHaveLength(0);
    } finally {
      act(() => {
        root.unmount();
      });
      consoleErrorSpy.mockRestore();
    }
  });

  it("keeps a single lifecycle card for same run+session+command in one message", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-1",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
        } as const,
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-2",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
          output: "done",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, {
        message,
        streaming: false,
        sessionKey: "agent:main:ui:test",
      }),
    );
    const matches = html.match(
      /exec:assistant:1771000000000:r1::agent:main:ui:test::ls -la ~\/Desktop:/g,
    );
    expect(matches?.length ?? 0).toBe(1);
  });

  it("suppresses stale lifecycle card after newer message owns the lifecycle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-14T00:00:00.000Z"));
    const sessionKey = "agent:main:ui:suppress";

    const staleInput: UIMessage = {
      id: "msg-old",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-1",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
        } as const,
      ],
    };
    const latestFinal: UIMessage = {
      id: "msg-new",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-2",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
          output: "done",
        } as const,
      ],
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => {
        root.render(
          createElement(MessageParts, { message: staleInput, streaming: false, sessionKey }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(1000);
        root.render(
          createElement(MessageParts, { message: latestFinal, streaming: false, sessionKey }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(1000);
        root.render(
          createElement(MessageParts, { message: staleInput, streaming: false, sessionKey }),
        );
      });

      expect(container.textContent ?? "").not.toContain(
        "exec:assistant:1771000000000:r1::agent:main:ui:suppress::ls -la ~/Desktop",
      );
    } finally {
      act(() => {
        root.unmount();
      });
      vi.useRealTimers();
    }
  });

  it("keeps non-exec tools on ToolEventCard path", () => {
    const message: UIMessage = {
      id: "msg-read-normalized",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "read",
          toolCallId: "call_I0juQg9HZ0gB68z8TTSMdvQy|fc_0c57b44d",
          state: "output-available",
          providerExecuted: true,
          input: { path: "/tmp/1.png" },
          output: "Read image file [image/png]",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).toContain("tool:read:call_I0juQg9HZ0gB68z8TTSMdvQy:read_compact");
    expect(html).not.toContain("tool:read:call_I0juQg9HZ0gB68z8TTSMdvQy|fc_0c57b44d:read_compact");
  });
});
