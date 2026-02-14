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
    ExecCard: ({
      record,
    }: {
      record: { attemptId: string; status: string; command: string; approvalId?: string };
    }) =>
      createElement(
        "div",
        null,
        `exec:${record.attemptId}:${record.status}:${record.command || "<empty>"}:${record.approvalId ?? ""}`,
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

  it("uses approval id as attempt key and keeps single exec card for same attempt", () => {
    const sessionKey = "agent:main:ui:test";
    const now = Date.now();
    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [
        {
          id: "abc12345",
          request: {
            sessionKey,
            command: "python3 -c \"print('ok')\"",
            runId: "run-1",
          },
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        },
      ],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });

    const message: UIMessage = {
      id: "msg-approval",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-1",
          state: "input-available",
          providerExecuted: true,
          input: { command: "python3 -c \"print('ok')\"" },
        } as const,
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-2",
          state: "input-streaming",
          providerExecuted: true,
          input: { command: "python3 -c \"print('ok')\"" },
        } as const,
      ],
    };

    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      act(() => {
        root.render(createElement(MessageParts, { message, streaming: false, sessionKey }));
      });
      const text = container.textContent ?? "";
      const matches = text.match(
        /exec:(approval:abc12345|attempt:run-1::agent:main:ui:test::python3 -c "print\('ok'\)"::assistant:1771000000000:r1:tool-[12]):/g,
      );
      expect(matches?.length ?? 0).toBe(1);
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });

  it("hides System exec receipt text from visible message body", () => {
    const message: UIMessage = {
      id: "msg-system-receipt",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "System: [2026-02-14 16:34:03 GMT+8] Exec finished (gateway id=0c8c1be9-908a-4b60-add8-0c6ac01eb9bc, session=ember-cloud, code 0)\nok",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    expect(html).not.toContain("Exec finished");
    expect(html).toContain('class="space-y-3"');
  });

  it("does not render no-command exec card when command is missing", () => {
    const message: UIMessage = {
      id: "msg-no-command",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:r1:tool-1",
          state: "output-available",
          providerExecuted: true,
          input: {},
          output: "ok",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    expect(html).not.toContain("<empty>");
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
  });
});
