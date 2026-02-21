import { describe, expect, it } from "vitest";
import {
  APPROVAL_RECOVERY_FOLLOWUPS_MS,
  getEffectiveHeartbeatThrottleMs,
  recordHistoryRefreshResult,
  resetHeartbeatBackoff,
  shouldRefreshHistoryOnHeartbeat,
} from "@/services/chat/historyRefreshPolicy";

describe("historyRefreshPolicy", () => {
  it("uses bounded approval recovery follow-ups", () => {
    expect(APPROVAL_RECOVERY_FOLLOWUPS_MS).toEqual([
      800, 2_000, 5_000, 10_000, 15_000, 30_000, 45_000, 60_000,
    ]);
  });

  it("refreshes on heartbeat when pending approval matches session", () => {
    const shouldRefresh = shouldRefreshHistoryOnHeartbeat({
      sessionKey: "agent:main:ui:abc",
      queue: [
        {
          id: "approval-1",
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 10_000,
          request: {
            command: "echo hi",
            sessionKey: "agent:main:ui:abc",
          },
        },
      ],
      runningByKey: {},
    });
    expect(shouldRefresh).toBe(true);
  });

  it("refreshes on heartbeat when running command matches session prefix", () => {
    const shouldRefresh = shouldRefreshHistoryOnHeartbeat({
      sessionKey: "agent:main:ui:abc",
      queue: [],
      runningByKey: {
        "agent:main:ui:abc::ls -la": Date.now(),
      },
    });
    expect(shouldRefresh).toBe(true);
  });

  it("skips heartbeat refresh when no pending/running exec for session", () => {
    const shouldRefresh = shouldRefreshHistoryOnHeartbeat({
      sessionKey: "agent:main:ui:abc",
      queue: [],
      runningByKey: {
        "agent:main:ui:other::pwd": Date.now(),
      },
    });
    expect(shouldRefresh).toBe(false);
  });

  it("refreshes on heartbeat during approval recovery window", () => {
    const shouldRefresh = shouldRefreshHistoryOnHeartbeat({
      sessionKey: "agent:main:ui:abc",
      queue: [],
      runningByKey: {},
      recoveryActive: true,
    });
    expect(shouldRefresh).toBe(true);
  });

  it("applies exponential heartbeat backoff after unchanged refreshes", () => {
    const sessionKey = "agent:main:ui:abc";
    resetHeartbeatBackoff(sessionKey);

    const initial = getEffectiveHeartbeatThrottleMs({ sessionKey, recoveryActive: true });
    recordHistoryRefreshResult(sessionKey, false);
    const afterOneUnchanged = getEffectiveHeartbeatThrottleMs({ sessionKey, recoveryActive: true });
    recordHistoryRefreshResult(sessionKey, false);
    const afterTwoUnchanged = getEffectiveHeartbeatThrottleMs({ sessionKey, recoveryActive: true });

    expect(initial).toBe(1_200);
    expect(afterOneUnchanged).toBeGreaterThan(initial);
    expect(afterTwoUnchanged).toBeGreaterThan(afterOneUnchanged);
  });

  it("resets heartbeat backoff after a changed refresh", () => {
    const sessionKey = "agent:main:ui:abc";
    resetHeartbeatBackoff(sessionKey);
    recordHistoryRefreshResult(sessionKey, false);
    const slowed = getEffectiveHeartbeatThrottleMs({ sessionKey, recoveryActive: true });
    recordHistoryRefreshResult(sessionKey, true);
    const reset = getEffectiveHeartbeatThrottleMs({ sessionKey, recoveryActive: true });

    expect(slowed).toBeGreaterThan(1_200);
    expect(reset).toBe(1_200);
  });
});
