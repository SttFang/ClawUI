import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";
import {
  buildExecLifecycleKey,
  buildFallbackAttemptId,
  buildSessionCommandKey,
  deriveExecLifecycleStatus,
  mergeExecLifecycleRecord,
  projectExecLifecycleRecord,
} from "../projector";

function createExecPart(overrides: Partial<DynamicToolUIPart>): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolName: "exec",
    toolCallId: "assistant:1771000000000:r1:tool-1",
    state: "input-available",
    providerExecuted: true,
    input: { command: "ls -la ~/Desktop" },
    ...overrides,
  } as DynamicToolUIPart;
}

describe("execLifecycle projector", () => {
  it("builds session-command key", () => {
    expect(buildSessionCommandKey("agent:main:ui:test", "ls   -la   ~/Desktop")).toBe(
      "agent:main:ui:test::ls -la ~/Desktop",
    );
  });

  it("builds fallback attempt id", () => {
    const attemptId = buildFallbackAttemptId({
      runId: "run-1",
      sessionKey: "agent:main:ui:test",
      command: "ls -la ~/Desktop",
      toolCallId: "assistant:1771000000000:r1:tool-1",
    });
    expect(attemptId).toBe(
      "attempt:run-1::agent:main:ui:test::ls -la ~/Desktop::assistant:1771000000000:r1:tool-1",
    );
  });

  it("uses attemptId as lifecycle key when provided", () => {
    expect(
      buildExecLifecycleKey({
        attemptId: "approval:abc",
        runId: "run-1",
        sessionKey: "s1",
        command: "pwd",
        toolCallId: "tool-1",
      }),
    ).toBe("approval:abc");
  });

  it("maps deny decision to denied status", () => {
    const status = deriveExecLifecycleStatus({
      partState: "input-available",
      preliminary: false,
      approvalRequested: false,
      runningMarked: false,
      decision: "deny",
    });
    expect(status).toBe("denied");
  });

  it("projects approval id into attempt-based record", () => {
    const record = projectExecLifecycleRecord({
      part: createExecPart({ state: "input-available" }),
      sessionKey: "agent:main:ui:test",
      messageId: "msg-1",
      partIndex: 0,
      now: 1000,
      approvalRequested: true,
      runningMarked: false,
      approvalId: "abc12345",
      runId: "run-1",
    });

    expect(record.attemptId).toBe("approval:abc12345");
    expect(record.lifecycleKey).toBe("approval:abc12345");
    expect(record.status).toBe("pending_approval");
  });

  it("prevents terminal status regression during merge", () => {
    const completed = projectExecLifecycleRecord({
      part: createExecPart({
        state: "output-available",
        output: "ok",
      }),
      sessionKey: "agent:main:ui:test",
      messageId: "msg-new",
      partIndex: 0,
      now: 2000,
      approvalRequested: false,
      runningMarked: false,
      attemptId: "approval:abc",
      runId: "run-1",
    });
    const stalePending = projectExecLifecycleRecord({
      part: createExecPart({ state: "input-available" }),
      sessionKey: "agent:main:ui:test",
      messageId: "msg-old",
      partIndex: 0,
      now: 1000,
      approvalRequested: true,
      runningMarked: false,
      attemptId: "approval:abc",
      runId: "run-1",
    });

    const merged = mergeExecLifecycleRecord(completed, stalePending);
    expect(merged.status).toBe("completed");
    expect(merged.messageId).toBe("msg-new");
  });
});
