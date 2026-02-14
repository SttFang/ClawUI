import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRunState } from "../run-state";

describe("ChatRunState", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("records approval without sessionKey and binds fallback to latest active run", () => {
    const state = new ChatRunState();
    const run = state.ensureRun({
      sessionKey: "session-1",
      clientRunId: "client-run-1",
    });

    state.recordApprovalRequest({ id: "approval-no-session" });

    const consumed = state.consumeApproval({ id: "approval-no-session" });
    expect(consumed.consumed).toBe(true);
    expect(consumed.reason).toBe("matched");
    if (!consumed.consumed) {
      throw new Error("approval-no-session should be consumed");
    }
    expect(consumed.approval).toBeDefined();
    expect(consumed.approval?.sessionKey).toBe("session-1");
    expect(consumed.run.traceId).toBe(run.traceId);
  });

  it("supports extended TTL and drops pending approvals after default TTL window", () => {
    const start = new Date("2026-02-13T00:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(start);

    const state = new ChatRunState();
    state.recordApprovalRequest({ id: "approval-60s", sessionKey: "session-2" });

    vi.setSystemTime(start + 60_000);
    expect(state.consumeApproval({ id: "approval-60s", sessionKey: "session-2" }).consumed).toBe(
      true,
    );

    state.recordApprovalRequest({ id: "approval-expire", sessionKey: "session-2" });
    vi.setSystemTime(start + 180_001);
    state.gc();
    const consumed = state.consumeApproval({ id: "approval-expire", sessionKey: "session-2" });
    expect(consumed.consumed).toBe(false);
    expect(consumed.reason).toBe("not_found");
  });

  it("consumes approval using trace-bound run even after run becomes terminal", () => {
    const state = new ChatRunState();
    const run = state.ensureRun({
      sessionKey: "session-terminal",
      clientRunId: "client-run-terminal",
    });

    state.recordApprovalRequest({
      id: "approval-terminal",
      sessionKey: "session-terminal",
      command: "python3 -c \"print('ok')\"",
    });

    run.status = "completed";
    state.touchRun(run);

    const consumed = state.consumeApproval({
      id: "approval-terminal",
      sessionKey: "session-terminal",
      traceId: run.traceId,
    });
    expect(consumed.consumed).toBe(true);
    if (!consumed.consumed) {
      throw new Error("approval-terminal should be consumed");
    }
    expect(consumed.reason).toBe("matched");
    expect(consumed.run.traceId).toBe(run.traceId);
    expect(consumed.run.status).toBe("completed");
  });
});
