import type { DynamicToolUIPart } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { initialState as execApprovalsInitialState } from "@/store/execApprovals/initialState";
import { useExecApprovalsStore } from "@/store/execApprovals/store";
import {
  commitExecTraceUpdate,
  clearTracesForSession,
  deriveNextExecTrace,
  shouldSuppressExecPart,
} from "../execTrace";

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

  it("derives exec trace without writing store", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-derive-1",
      state: "input-available",
      input: { command: "pwd" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    const before = useA2UIExecTraceStore.getState().tracesByKey;
    const result = deriveNextExecTrace({
      part,
      sessionKey: "agent:main:ui:test",
    });
    const after = useA2UIExecTraceStore.getState().tracesByKey;

    expect(result.nextTrace.status).toBe("running");
    expect(after).toBe(before);
  });

  it("shouldSuppressExecPart is pure and does not write store", () => {
    const batchSpy = vi.spyOn(useA2UIExecTraceStore.getState(), "batchSet");
    const part = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-pure-1",
      state: "input-available",
      input: { command: "ls -la" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    const result = shouldSuppressExecPart(part, "agent:main:ui:test");

    expect(result).toBe(false);
    expect(batchSpy).not.toHaveBeenCalled();
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

    commitExecTraceUpdate({ part: startPart, sessionKey: "agent:main:ui:test" });
    const trace = commitExecTraceUpdate({ part: finalPart, sessionKey: "agent:main:ui:test" });

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

    commitExecTraceUpdate({ part: startPart, sessionKey: "agent:main:ui:test" });
    const completed = commitExecTraceUpdate({
      part: finalPart,
      sessionKey: "agent:main:ui:test",
    });
    const late = commitExecTraceUpdate({
      part: lateUpdatePart,
      sessionKey: "agent:main:ui:test",
    });

    expect(completed.status).toBe("completed");
    expect(late.status).toBe("completed");
  });

  it("should suppress stale non-terminal snapshot for the same terminal toolCallId", () => {
    const sessionKey = "agent:main:ui:test";
    const inputPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-same-id-1",
      state: "input-available",
      input: { command: "python3 -c \"print('ok')\"" },
      providerExecuted: true,
    } as DynamicToolUIPart;
    const finalPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-same-id-1",
      state: "output-available",
      input: { command: "python3 -c \"print('ok')\"" },
      output: "ok",
      providerExecuted: true,
    } as DynamicToolUIPart;

    commitExecTraceUpdate({ part: finalPart, sessionKey });

    expect(shouldSuppressExecPart(inputPart, sessionKey)).toBe(true);
    expect(shouldSuppressExecPart(finalPart, sessionKey)).toBe(false);
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

    commitExecTraceUpdate({ part: startPart, sessionKey });
    const completed = commitExecTraceUpdate({ part: finalPart, sessionKey });
    clearTracesForSession(sessionKey);
    const restarted = commitExecTraceUpdate({ part: lateUpdatePart, sessionKey });

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

    commitExecTraceUpdate({ part: oldInput, sessionKey });
    commitExecTraceUpdate({ part: newFinal, sessionKey });

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

    commitExecTraceUpdate({ part: oldFinal, sessionKey });

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

    commitExecTraceUpdate({ part: terminalUnknownOrder, sessionKey });
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

  it("should suppress stale completed trace when same command has newer active trace", () => {
    const sessionKey = "agent:main:ui:suppress";
    const oldCompleted = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771007000000:old:tool-1",
      state: "output-available",
      input: { command: "ls -la ~/Desktop" },
      output: "done",
      providerExecuted: true,
    } as DynamicToolUIPart;
    const newPending = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771008000000:new:tool-1",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    commitExecTraceUpdate({ part: oldCompleted, sessionKey });
    useExecApprovalsStore.setState((state) => ({
      ...state,
      queue: [
        {
          id: "pending-newer-command",
          request: { sessionKey, command: "ls -la ~/Desktop" },
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 60_000,
        },
      ],
    }));
    commitExecTraceUpdate({ part: newPending, sessionKey });

    expect(shouldSuppressExecPart(oldCompleted, sessionKey)).toBe(true);
  });

  it("should suppress older pending trace when a newer pending trace exists for same command", () => {
    const sessionKey = "agent:main:ui:suppress";
    const olderPending = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771008000000:old:tool-1",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;
    const newerPending = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "assistant:1771009000000:new:tool-1",
      state: "input-available",
      input: { command: "ls -la ~/Desktop" },
      providerExecuted: true,
    } as DynamicToolUIPart;

    commitExecTraceUpdate({ part: olderPending, sessionKey });
    commitExecTraceUpdate({ part: newerPending, sessionKey });

    expect(shouldSuppressExecPart(olderPending, sessionKey)).toBe(true);
    expect(shouldSuppressExecPart(newerPending, sessionKey)).toBe(false);
  });

  it("should treat 'Command still running' output as running, not completed", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-bg-1",
      state: "output-available",
      input: { command: "python3 long_task.py" },
      output:
        "Command still running (session glow-cove, pid 31133). Use process (list/poll/log/write/kill/clear/remove) for follow-up.",
      providerExecuted: true,
    } as DynamicToolUIPart;

    const result = deriveNextExecTrace({
      part,
      sessionKey: "agent:main:ui:test",
    });

    expect(result.nextTrace.status).toBe("running");
  });

  it("should not suppress a background-running exec part", () => {
    const sessionKey = "agent:main:ui:test";
    const bgPart = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "tool-bg-suppress-1",
      state: "output-available",
      input: { command: "python3 long_task.py" },
      output:
        "Command still running (session glow-cove, pid 31133). Use process (list/poll/log/write/kill/clear/remove) for follow-up.",
      providerExecuted: true,
    } as DynamicToolUIPart;

    commitExecTraceUpdate({ part: bgPart, sessionKey });

    expect(shouldSuppressExecPart(bgPart, sessionKey)).toBe(false);
  });

  it("should suppress terminal fallback exec card without explicit command", () => {
    const sessionKey = "agent:main:ui:suppress";
    const fallbackTerminal = {
      type: "dynamic-tool",
      toolName: "exec",
      toolCallId: "call_without_command",
      state: "output-available",
      input: {},
      output: "No output - tool completed successfully.",
      providerExecuted: true,
    } as DynamicToolUIPart;

    expect(shouldSuppressExecPart(fallbackTerminal, sessionKey)).toBe(true);
  });
});
