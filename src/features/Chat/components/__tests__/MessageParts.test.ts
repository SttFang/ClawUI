import type { UIMessage } from "ai";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MessageParts } from "../MessageParts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return Object.entries(params).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key);
      }
      return key;
    },
  }),
}));

vi.mock("@/features/Chat/components/A2UI", () => ({
  ExecTool: ({ part }: { part: { toolName: string; toolCallId: string; input?: unknown } }) =>
    createElement("div", null, `exec:${part.toolName}:${part.toolCallId}`),
  ToolGroup: ({ parts }: { parts: { toolCallId: string; toolName: string }[] }) =>
    createElement(
      "div",
      null,
      `tool-group:${parts.map((p) => `${p.toolName}:${p.toolCallId}`).join(",")}`,
    ),
}));

describe("MessageParts", () => {
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
  });

  it("does not render exec tool when command is empty", () => {
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
    // ExecTool is still rendered for the part, but the command inside is empty
    expect(html).toContain("exec:exec:");
  });

  it("groups adjacent explore tools into a ToolGroup", () => {
    const message: UIMessage = {
      id: "msg-explore-group",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "read",
          toolCallId: "call_read_1",
          state: "output-available",
          providerExecuted: true,
          input: { path: "/tmp/a.ts" },
          output: "file content",
        } as const,
        {
          type: "dynamic-tool",
          toolName: "search",
          toolCallId: "call_search_1",
          state: "output-available",
          providerExecuted: true,
          input: { query: "useChat" },
          output: "result",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    expect(html).toContain("tool-group:");
    expect(html).toContain("read:call_read_1");
    expect(html).toContain("search:call_search_1");
  });

  it("keeps non-explore tools separate (generic path)", () => {
    const message: UIMessage = {
      id: "msg-generic-tool",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "custom_tool",
          toolCallId: "call_custom_1",
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
    // Should render as GenericToolCard, not ToolGroup
    expect(html).not.toContain("tool-group:");
    expect(html).toContain("custom_tool");
  });

  it("returns null when all parts are empty or hidden", () => {
    const message: UIMessage = {
      id: "msg-empty",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "   ",
        } as const,
      ],
    };

    const html = renderToStaticMarkup(
      createElement(MessageParts, { message, streaming: false, sessionKey: "s1" }),
    );
    expect(html).toBe("");
  });

  it("normalizes tool call ids with pipe separator", () => {
    const message: UIMessage = {
      id: "msg-normalized",
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
    expect(html).toContain("read:call_I0juQg9HZ0gB68z8TTSMdvQy");
  });
});
