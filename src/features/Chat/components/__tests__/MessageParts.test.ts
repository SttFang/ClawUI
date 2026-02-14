import type { DynamicToolUIPart, UIMessage } from "ai";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTracesForSession, commitExecTraceUpdate } from "@/components/A2UI/execTrace";
import { initialState as a2uiExecTraceInitialState } from "@/store/a2uiExecTrace/initialState";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { MessageParts } from "../MessageParts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/A2UI", async () => {
  const actual = await vi.importActual<typeof import("@/components/A2UI")>("@/components/A2UI");
  const { useA2UIExecTraceStore: useTraceStore } = await vi.importActual<
    typeof import("@/store/a2uiExecTrace/store")
  >("@/store/a2uiExecTrace/store");

  return {
    ...actual,
    ExecActionItem: ({ part }: { part: { toolCallId: string; state: string } }) => {
      useTraceStore((s) => s.terminalByCommand);
      return createElement("div", null, `exec:${part.toolCallId}:${part.state}`);
    },
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
    useA2UIExecTraceStore.setState({
      ...a2uiExecTraceInitialState,
      tracesByKey: {},
      terminalByCommand: {},
    });
  });

  it("keeps renderer console.error at zero for exec render path", () => {
    const sessionKey = "agent:main:ui:messageparts-console-error-zero";
    clearTracesForSession(sessionKey);

    const firstMessage: UIMessage = {
      id: "msg-render-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:test:tool-1",
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
          toolCallId: "assistant:1771000000999:test:tool-1",
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
      clearTracesForSession(sessionKey);
    }
  });

  it("does not write trace store during render", () => {
    const sessionKey = "agent:main:ui:messageparts-render-pure";
    clearTracesForSession(sessionKey);
    const batchSpy = vi.spyOn(useA2UIExecTraceStore.getState(), "batchSet");
    const message: UIMessage = {
      id: "msg-render-pure",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-render-pure",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la" },
        } as const,
      ],
    };

    renderToStaticMarkup(createElement(MessageParts, { message, streaming: false, sessionKey }));

    expect(batchSpy).not.toHaveBeenCalled();
    batchSpy.mockRestore();
  });

  it("suppresses stale input-only exec card after newer terminal card is rendered", () => {
    const sessionKey = "agent:main:ui:messageparts-suppress";
    clearTracesForSession(sessionKey);

    const staleInput: UIMessage = {
      id: "msg-old",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-old",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
        } as const,
      ],
    };

    // Seed stale input first (older message already in list).
    renderToStaticMarkup(
      createElement(MessageParts, { message: staleInput, streaming: false, sessionKey }),
    );
    commitExecTraceUpdate({
      part: staleInput.parts[0] as DynamicToolUIPart,
      sessionKey,
    });

    const latestFinal: UIMessage = {
      id: "msg-new",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-new",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
          output: "done",
        } as const,
      ],
    };

    // Newer terminal message arrives.
    renderToStaticMarkup(
      createElement(MessageParts, { message: latestFinal, streaming: false, sessionKey }),
    );
    commitExecTraceUpdate({
      part: latestFinal.parts[0] as DynamicToolUIPart,
      sessionKey,
    });

    // Older message re-renders and should be suppressed.
    const html = renderToStaticMarkup(
      createElement(MessageParts, { message: staleInput, streaming: false, sessionKey }),
    );

    expect(html).not.toContain("exec:tool-old:input-available");
    clearTracesForSession(sessionKey);
  });

  it("keeps a single render node per exec toolCallId", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-exec",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la" },
        } as const,
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-exec",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la" },
          output: "done",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    const matches = html.match(/exec:tool-exec:/g);

    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it("suppresses older pending exec card in same message when newer terminal exists", () => {
    const sessionKey = "agent:main:ui:messageparts-same-message";
    clearTracesForSession(sessionKey);

    const message: UIMessage = {
      id: "msg-same-message",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000000:old:tool-1",
          state: "input-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
        } as const,
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "assistant:1771000000999:new:tool-1",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la ~/Desktop" },
          output: "done",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey }),
    );

    expect(html).not.toContain("exec:assistant:1771000000000:old:tool-1:input-available");
    expect(html).toContain("exec:assistant:1771000000999:new:tool-1:output-available");
    clearTracesForSession(sessionKey);
  });

  it("does not render completed summary in default message flow", () => {
    const message: UIMessage = {
      id: "msg-3",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-summary",
          state: "output-available",
          providerExecuted: true,
          input: { command: "echo done" },
          output: "ok",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).not.toContain("execCompletedSummary");
    expect(html).toContain("exec:tool-summary:output-available");
  });

  it("does not render pure whitespace text", () => {
    const message: UIMessage = {
      id: "msg-4",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "   \n  \t  ",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).toContain('class="space-y-3"');
  });

  it("renders final exec card as a single exec block", () => {
    const message: UIMessage = {
      id: "msg-5",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-final",
          state: "output-available",
          providerExecuted: true,
          input: { command: "echo done" },
          output: "ok",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    const execCount = html.match(/exec:tool-final/g)?.length ?? 0;

    expect(execCount).toBe(1);
  });

  it("folds tool receipt text when tool card exists in the same message", () => {
    const message: UIMessage = {
      id: "msg-tool-receipt",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "System: Exec finished (code 0)",
        } as const,
        {
          type: "dynamic-tool",
          toolName: "exec",
          toolCallId: "tool-receipt",
          state: "output-available",
          providerExecuted: true,
          input: { command: "ls -la" },
          output: "System: Exec finished (code 0)",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).not.toContain("System: Exec finished (code 0)");
    expect(html).toContain("exec:tool-receipt:output-available");
  });

  it("treats bash tool as exec-style action card", () => {
    const message: UIMessage = {
      id: "msg-bash-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "bash",
          toolCallId: "tool-bash-1",
          state: "output-available",
          providerExecuted: true,
          input: { command: "pwd" },
          output: "/tmp",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).toContain("exec:tool-bash-1:output-available");
    expect(html).not.toContain("tool:bash:tool-bash-1");
  });

  it("normalizes non-exec toolCallId with call/fc suffix inside message render", () => {
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

  it("hides session_status tool cards by policy", () => {
    const message: UIMessage = {
      id: "msg-session-status-hidden",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "session_status",
          toolCallId: "tool-session-status-1",
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

    expect(html).not.toContain("tool:session_status");
  });

  it("renders unknown tools with generic card fallback", () => {
    const message: UIMessage = {
      id: "msg-unknown-tool",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "plugin_custom_tool",
          toolCallId: "tool-plugin-1",
          state: "output-available",
          providerExecuted: true,
          input: {},
          output: "done",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );

    expect(html).toContain("tool:plugin_custom_tool:tool-plugin-1:generic");
  });
});
