import type { DynamicToolUIPart } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { upsertExecTrace } from "../execTrace";

describe("execTrace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should clear running state once exec finishes", () => {
    const clearRunning = vi.fn();
    vi.spyOn(useExecApprovalsStore, "getState").mockReturnValue({
      clearRunning,
    } as unknown as ReturnType<typeof useExecApprovalsStore.getState>);

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
    expect(clearRunning).toHaveBeenCalledWith("agent:main:ui:test", "which codex");
  });
});
