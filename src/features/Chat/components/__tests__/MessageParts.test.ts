import type { UIMessage } from "ai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
    ExecActionItem: ({ part }: { part: { toolCallId: string; state: string } }) =>
      createElement("div", null, `exec:${part.toolCallId}:${part.state}`),
    ToolEventCard: ({ part }: { part: { toolName: string; toolCallId: string } }) =>
      createElement("div", null, `tool:${part.toolName}:${part.toolCallId}`),
  };
});

describe("MessageParts", () => {
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
});
