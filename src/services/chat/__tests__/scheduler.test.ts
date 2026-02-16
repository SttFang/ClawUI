import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHistoryRefreshScheduler,
  mapChatStateToSignal,
  mapHeartbeatToSignal,
  mapLifecyclePhaseToSignal,
  mapApprovalRequestedToSignal,
  mapApprovalResolvedRawToSignal,
  APPROVAL_FOLLOWUP_DELAYS_MS,
  type SchedulerCallbacks,
} from "../historySync/scheduler";

function makeCallbacks(overrides?: Partial<SchedulerCallbacks>): SchedulerCallbacks & {
  execCalls: { force: boolean; reason: string; allowRetry: boolean }[];
} {
  const execCalls: { force: boolean; reason: string; allowRetry: boolean }[] = [];
  return {
    execCalls,
    executeRefresh: vi.fn(async (opts) => {
      execCalls.push(opts);
      return true;
    }),
    extendRecoveryWindow: vi.fn(),
    clearRunningForSession: vi.fn(),
    resetHeartbeatBackoff: vi.fn(),
    shouldRefreshOnHeartbeat: vi.fn(() => true),
    isRecoveryActive: vi.fn(() => false),
    ...overrides,
  };
}

describe("HistoryRefreshScheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("critical signals execute immediately", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "critical", force: true, reason: "chat-final", allowRetry: true });
    expect(cb.execCalls).toHaveLength(1);
    expect(cb.execCalls[0]).toEqual({ force: true, reason: "chat-final", allowRetry: true });
    scheduler.dispose();
  });

  it("high signals merge within 100ms window", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "high", force: false, reason: "a", allowRetry: true });
    scheduler.emit({ priority: "high", force: true, reason: "b", allowRetry: false });
    expect(cb.execCalls).toHaveLength(0);

    vi.advanceTimersByTime(100);
    expect(cb.execCalls).toHaveLength(1);
    expect(cb.execCalls[0].force).toBe(true); // OR merge
    expect(cb.execCalls[0].reason).toBe("a+b");
    expect(cb.execCalls[0].allowRetry).toBe(true); // OR merge
    scheduler.dispose();
  });

  it("critical cancels pending high merge", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "high", force: false, reason: "high-a" });
    scheduler.emit({ priority: "critical", force: true, reason: "chat-final" });
    expect(cb.execCalls).toHaveLength(1);
    expect(cb.execCalls[0].reason).toBe("chat-final");

    vi.advanceTimersByTime(200);
    // high merge was cleared, no extra call
    expect(cb.execCalls).toHaveLength(1);
    scheduler.dispose();
  });

  it("normal signals execute immediately (throttling in useHistoryRefresh)", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "normal", force: false, reason: "approval-requested" });
    expect(cb.execCalls).toHaveLength(1);
    scheduler.dispose();
  });

  it("low signals execute immediately (throttling in useHistoryRefresh)", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "low", force: false, reason: "heartbeat" });
    expect(cb.execCalls).toHaveLength(1);
    scheduler.dispose();
  });

  it("emitApprovalRecovery fires immediate + followups", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emitApprovalRecovery();
    expect(cb.extendRecoveryWindow).toHaveBeenCalledWith(120_000);
    expect(cb.resetHeartbeatBackoff).toHaveBeenCalled();
    // immediate critical
    expect(cb.execCalls).toHaveLength(1);
    expect(cb.execCalls[0].reason).toBe("approval-resolved-immediate");

    // followups
    for (const delayMs of APPROVAL_FOLLOWUP_DELAYS_MS) {
      vi.advanceTimersByTime(delayMs);
    }
    // 8 followups merged into high signals at various times
    // at least 1 + some followups should have fired
    expect(cb.execCalls.length).toBeGreaterThan(1);
    scheduler.dispose();
  });

  it("emitApprovalRecovery clears previous followups", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emitApprovalRecovery();
    const firstCount = cb.execCalls.length;
    // Call again — should clear old timers
    scheduler.emitApprovalRecovery();
    const secondCount = cb.execCalls.length;
    expect(secondCount).toBe(firstCount + 1); // only new immediate

    scheduler.dispose();
  });

  it("dispose clears all timers", () => {
    const cb = makeCallbacks();
    const scheduler = createHistoryRefreshScheduler(cb);

    scheduler.emit({ priority: "high", force: false, reason: "pending" });
    scheduler.emitApprovalRecovery();
    const beforeDispose = cb.execCalls.length;

    scheduler.dispose();
    vi.advanceTimersByTime(120_000);
    // No new calls after dispose
    expect(cb.execCalls.length).toBe(beforeDispose);
  });
});

describe("Signal mapping helpers", () => {
  it("mapHeartbeatToSignal returns exec-event as high priority", () => {
    const signal = mapHeartbeatToSignal("exec-event", false);
    expect(signal).toEqual({
      priority: "high",
      force: true,
      reason: "heartbeat-exec-event",
      allowRetry: true,
    });
  });

  it("mapHeartbeatToSignal returns low for normal heartbeat when shouldRefresh", () => {
    const signal = mapHeartbeatToSignal("", true);
    expect(signal?.priority).toBe("low");
    expect(signal?.force).toBe(false);
  });

  it("mapHeartbeatToSignal returns null when not refreshing", () => {
    expect(mapHeartbeatToSignal("", false)).toBeNull();
  });

  it("mapChatStateToSignal returns critical for final/aborted/error", () => {
    for (const state of ["final", "aborted", "error"]) {
      const signal = mapChatStateToSignal(state);
      expect(signal?.priority).toBe("critical");
      expect(signal?.force).toBe(true);
    }
  });

  it("mapChatStateToSignal returns null for delta", () => {
    expect(mapChatStateToSignal("delta")).toBeNull();
  });

  it("mapLifecyclePhaseToSignal returns critical for end/error", () => {
    expect(mapLifecyclePhaseToSignal("end")?.priority).toBe("critical");
    expect(mapLifecyclePhaseToSignal("error")?.priority).toBe("critical");
  });

  it("mapLifecyclePhaseToSignal returns null for start", () => {
    expect(mapLifecyclePhaseToSignal("start")).toBeNull();
  });

  it("mapApprovalRequestedToSignal returns normal priority", () => {
    const signal = mapApprovalRequestedToSignal();
    expect(signal.priority).toBe("normal");
  });

  it("mapApprovalResolvedRawToSignal returns critical", () => {
    const signal = mapApprovalResolvedRawToSignal();
    expect(signal.priority).toBe("critical");
    expect(signal.force).toBe(true);
  });
});
