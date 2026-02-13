import type { DynamicToolUIPart } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState as execApprovalsInitialState } from "@/store/execApprovals/initialState";
import { useExecApprovalsStore } from "@/store/execApprovals/store";
import { clearTracesForSession, shouldSuppressExecPart, upsertExecTrace } from "../execTrace";

describe("execTrace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
    clearTracesForSession("agent:main:ui:test");
    clearTracesForSession("agent:main:ui:session-a");
    clearTracesForSession("agent:main:ui:suppress");
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

  it("should clear trace cache for a specific session", () => {
    const sessionKey = "agent:main:ui:session-a";
    const startPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-clear-1",
      state: "input-available",
      input: { command: "pwd" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    const finalPart = {
      ...startPart,
      state: "output-available",
      output: "/tmp",
    } as DynamicToolUIPart;

    const lateUpdatePart = {
      ...startPart,
      state: "input-streaming",
    } as DynamicToolUIPart;

    upsertExecTrace(startPart, sessionKey);
    const completed = upsertExecTrace(finalPart, sessionKey);
    clearTracesForSession(sessionKey);
    const restarted = upsertExecTrace(lateUpdatePart, sessionKey);

    expect(completed.status).toBe("completed");
    expect(restarted.status).toBe("running");
  });

  it("should suppress stale non-terminal exec part when same command has newer terminal trace", () => {
    const sessionKey = "agent:main:ui:suppress";
    const oldInput = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-old",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;
    const newFinal = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-new",
      state: "output-available",
      input: { command: "ls -la ~/Desktop" },
      output: "done",
      providerExecuted: true,
    } as DynamicToolUIPart;

    upsertExecTrace(oldInput, sessionKey);
    upsertExecTrace(newFinal, sessionKey);

    expect(shouldSuppressExecPart(oldInput, sessionKey)).toBe(true);
    expect(shouldSuppressExecPart(newFinal, sessionKey)).toBe(false);
  });

  it("should not suppress a newer pending trace when terminal trace is older", () => {
    const sessionKey = "agent:main:ui:suppress";
    const oldFinal = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771000000000:old:tool-1",
      state: "output-available",
      input: { command: "ls -la ~/Desktop" },
      output: "done",
      providerExecuted: true,
    } as DynamicToolUIPart;
    const newPending = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771000009999:new:tool-1",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    upsertExecTrace(oldFinal, sessionKey);

    expect(shouldSuppressExecPart(newPending, sessionKey)).toBe(false);
  });

  it("should keep current pending trace visible when command is active in approvals store", () => {
    const sessionKey = "agent:main:ui:suppress";
    const terminalUnknownOrder = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "call_unknown_order",
      state: "output-available",
      input: { command: "ls -la ~/Desktop" },
      output: "done",
      providerExecuted: true,
    } as DynamicToolUIPart;
    const currentPending = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771007777777:tool-1",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    upsertExecTrace(terminalUnknownOrder, sessionKey);
    useExecApprovalsStore.setState((state) => ({
      ...state,
      queue: [
        {
          id: "pending-visible",
          request: { sessionKey, command: "ls -la ~/Desktop" },
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 60_000,
        },
      ],
    }));

    expect(shouldSuppressExecPart(currentPending, sessionKey)).toBe(false);
  });
});
