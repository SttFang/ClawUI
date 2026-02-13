import { describe, expect, it, vi } from "vitest";
import {
  ChatRunState,
  DEFAULT_PENDING_APPROVAL_TTL_MS,
} from "../run-state";

describe("ChatRunState approval recovery", () => {
  it("binds pending approval to most recent active run when session key is missing", () => {
    const state = new ChatRunState();
    const activeRun = state.ensureRun({
      sessionKey: "agent:main:ui:unbound",
      clientRunId: "client-run-1",
    });

    const pendingRun = state.recordApprovalRequest({
      id: "approval-unbound",
      command: "echo hello",
    });

    expect(pendingRun).toBe(activeRun);

    const consumed = state.consumeApproval({ id: "approval-unbound" });
    expect(consumed.consumed).toBe(true);
    if (!consumed.consumed) return;
    expect(consumed.run).toBe(activeRun);
    expect(consumed.reason).toBe("matched");
  });

  it("drops pending approvals after ttl but keeps those still inside ttl", () => {
    const state = new ChatRunState();
    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000_000);
    const expired = state.recordApprovalRequest({
      id: "approval-expired",
      sessionKey: "agent:main:ui:ttl",
      command: "echo old",
    });
    expect(expired).not.toBeNull();

    nowSpy.mockReturnValue(1_000_000 + DEFAULT_PENDING_APPROVAL_TTL_MS + 1);
    state.gc();
    const consumedExpired = state.consumeApproval({ id: "approval-expired" });
    expect(consumedExpired.consumed).toBe(false);
    if (consumedExpired.consumed) {
      expect(consumedExpired.reason).not.toBe("matched");
    }

    nowSpy.mockReturnValue(1_000_000 + DEFAULT_PENDING_APPROVAL_TTL_MS - 1_000);
    const keep = state.recordApprovalRequest({
      id: "approval-keep",
      sessionKey: "agent:main:ui:ttl",
      command: "echo new",
    });
    expect(keep).not.toBeNull();
    const consumedKeep = state.consumeApproval({ id: "approval-keep" });
    expect(consumedKeep.consumed).toBe(true);
    if (consumedKeep.consumed) {
      expect(consumedKeep.reason).toBe("matched");
    }

    nowSpy.mockRestore();
  });

  it("falls back to latest active run when session run is no longer active", () => {
    const state = new ChatRunState();
    const sessionRun = state.ensureRun({
      sessionKey: "agent:main:ui:session",
      clientRunId: "client-run-session",
    });
    const otherRun = state.ensureRun({
      sessionKey: "agent:main:ui:other",
      clientRunId: "client-run-other",
    });

    state.recordApprovalRequest({
      id: "approval-fallback",
      sessionKey: "agent:main:ui:session",
      command: "ls",
    });

    sessionRun.status = "completed";
    const consumed = state.consumeApproval({ id: "approval-fallback" });
    expect(consumed.consumed).toBe(true);
    if (!consumed.consumed) return;
    expect(consumed.run?.traceId).toBe(otherRun.traceId);
    expect(consumed.reason).toBe("fallback");
  });
});
