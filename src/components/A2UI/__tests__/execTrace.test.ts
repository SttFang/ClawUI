import type { DynamicToolUIPart } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertExecTrace } from "../execTrace";

describe("execTrace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should mark exec trace as completed when final output arrives", () => {
    const startPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-1",
      state: "input-available",
      input: { command: "which codex" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    const finalPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-1",
      state: "output-available",
      input: { command: "which codex" },
      output: "/usr/local/bin/codex",
      providerExecuted: true,
    } as DynamicToolUIPart;

    upsertExecTrace(startPart, "agent:main:ui:test");
    const trace = upsertExecTrace(finalPart, "agent:main:ui:test");

    expect(trace.status).toBe("completed");
  });

  it("should keep terminal trace status when late start/update arrives", () => {
    const startPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-guard-1",
      state: "input-available",
      input: { command: "codex --help" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    const finalPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-guard-1",
      state: "output-available",
      input: { command: "codex --help" },
      output: "done",
      providerExecuted: true,
    } as DynamicToolUIPart;

    const lateUpdatePart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-guard-1",
      state: "input-streaming",
      input: { command: "codex --help" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    upsertExecTrace(startPart, "agent:main:ui:test");
    const completed = upsertExecTrace(finalPart, "agent:main:ui:test");
    const late = upsertExecTrace(lateUpdatePart, "agent:main:ui:test");

    expect(completed.status).toBe("completed");
    expect(late.status).toBe("completed");
  });
});
