import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";
import {
  buildExecLifecycleKey,
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
  it("builds lifecycle key with run+session+command", () => {
    const key = buildExecLifecycleKey({
      runId: "run-1",
      sessionKey: "agent:main:ui:test",
      command: "ls -la ~/Desktop",
      toolCallId: "assistant:1771000000000:r1:tool-1",
    });
    expect(key).toBe("run-1::agent:main:ui:test::ls -la ~/Desktop");
  });

  it("maps approval pending to pending_approval status", () => {
    const status = deriveExecLifecycleStatus({
      partState: "input-available",
      preliminary: false,
      approvalRequested: true,
      runningMarked: false,
    });
    expect(status).toBe("pending_approval");
  });

  it("keeps output-available preliminary as running", () => {
    const status = deriveExecLifecycleStatus({
      partState: "output-available",
      preliminary: true,
      approvalRequested: false,
      runningMarked: false,
    });
    expect(status).toBe("running");
  });

  it("projects final output to completed terminal record", () => {
    const record = projectExecLifecycleRecord({
      part: createExecPart({
        state: "output-available",
        output: "ok",
      }),
      sessionKey: "agent:main:ui:test",
      messageId: "msg-1",
      partIndex: 0,
      now: 1000,
      approvalRequested: false,
      runningMarked: false,
      runId: "run-1",
    });

    expect(record.status).toBe("completed");
    expect(record.endedAtMs).toBe(1000);
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
      runId: "run-1",
    });
    const stalePending = projectExecLifecycleRecord({
      part: createExecPart({
        state: "input-available",
      }),
      sessionKey: "agent:main:ui:test",
      messageId: "msg-old",
      partIndex: 0,
      now: 1000,
      approvalRequested: true,
      runningMarked: false,
      runId: "run-1",
    });

    const merged = mergeExecLifecycleRecord(completed, stalePending);
    expect(merged.status).toBe("completed");
    expect(merged.messageId).toBe("msg-new");
  });
});
