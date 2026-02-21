import { describe, expect, it } from "vitest";
import { _parseContentParts as parseContentParts, _parseMessages as parseMessages } from "../useSubagentHistory";

describe("parseContentParts", () => {
  it("should parse type:toolCall blocks directly (gateway camelCase format)", () => {
    const content = [
      {
        type: "toolCall",
        id: "call_abc123",
        name: "web_search",
        arguments: { query: "test query", count: 5 },
        partialJson: '{"query":"test query","count":5}',
      },
    ];

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      type: "tool_call",
      toolCallId: "call_abc123",
      toolName: "web_search",
      args: { query: "test query", count: 5 },
    });
  });

  it("should parse type:tool_use blocks (Anthropic format)", () => {
    const content = [
      { type: "tool_use", id: "toolu_xyz", name: "read", input: { path: "/tmp/foo" } },
    ];

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      type: "tool_call",
      toolCallId: "toolu_xyz",
      toolName: "read",
      args: { path: "/tmp/foo" },
    });
  });

  it("should parse JSON-serialized toolCall strings inside text blocks", () => {
    const content = [
      {
        type: "text",
        text: '{"type":"toolCall","id":"call_X","name":"web_fetch","arguments":{"url":"https://example.com"},"partialJson":"{\\"url\\":\\"https://example.com\\"}"}',
      },
    ];

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      type: "tool_call",
      toolCallId: "call_X",
      toolName: "web_fetch",
      args: { url: "https://example.com" },
    });
  });

  it("should parse toolCall string with broken partialJson (unescaped inner quotes)", () => {
    const content =
      '{"type":"toolCall","id":"call_Y","name":"web_search","arguments":{"query":"AI"},"partialJson":"{"query":"AI"}"}';

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({
      type: "tool_call",
      toolCallId: "call_Y",
      toolName: "web_search",
      args: { query: "AI" },
    });
  });

  it("should fallback to tryParseToolCall for unknown block types", () => {
    // Simulate an unknown type that happens to be a stringified toolCall
    const content = [
      { type: "someNewType", data: "foo" },
    ];

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(1);
    // Unknown type → JSON.stringify → no toolCall match → text
    expect(parts[0].type).toBe("text");
  });

  it("should handle mixed content blocks", () => {
    const content = [
      { type: "thinking", thinking: "Let me search..." },
      {
        type: "toolCall",
        id: "call_1",
        name: "web_search",
        arguments: { query: "quantum" },
      },
      { type: "text", text: "Here are the results." },
      {
        type: "tool_use",
        id: "toolu_2",
        name: "read",
        input: { path: "/data.json" },
      },
    ];

    const parts = parseContentParts(content);
    expect(parts).toHaveLength(4);
    expect(parts[0]).toEqual({ type: "thinking", thinking: "Let me search..." });
    expect(parts[1]).toEqual({
      type: "tool_call",
      toolCallId: "call_1",
      toolName: "web_search",
      args: { query: "quantum" },
    });
    expect(parts[2]).toEqual({ type: "text", text: "Here are the results." });
    expect(parts[3]).toEqual({
      type: "tool_call",
      toolCallId: "toolu_2",
      toolName: "read",
      args: { path: "/data.json" },
    });
  });

  it("should parse plain text content strings", () => {
    const parts = parseContentParts("Hello world");
    expect(parts).toEqual([{ type: "text", text: "Hello world" }]);
  });

  it("should return empty for null/undefined content", () => {
    expect(parseContentParts(null)).toEqual([]);
    expect(parseContentParts(undefined)).toEqual([]);
    expect(parseContentParts("")).toEqual([]);
  });
});

describe("parseMessages", () => {
  it("should parse assistant message with toolCall content blocks", () => {
    const raw = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "planning search" },
          {
            type: "toolCall",
            id: "call_abc",
            name: "web_search",
            arguments: { query: "NIST post-quantum" },
          },
        ],
      },
    ];

    const messages = parseMessages(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].parts).toHaveLength(2);
    expect(messages[0].parts[0].type).toBe("thinking");
    expect(messages[0].parts[1]).toEqual({
      type: "tool_call",
      toolCallId: "call_abc",
      toolName: "web_search",
      args: { query: "NIST post-quantum" },
    });
  });

  it("should parse toolResult messages", () => {
    const raw = [
      {
        role: "toolResult",
        toolCallId: "call_abc",
        content: "Search returned 5 results",
        isError: false,
      },
    ];

    const messages = parseMessages(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("toolResult");
    expect(messages[0].parts[0]).toEqual({
      type: "tool_result",
      toolCallId: "call_abc",
      content: "Search returned 5 results",
      isError: false,
    });
  });
});
