import { describe, expect, it } from "vitest";
import {
  APPROVAL_RECOVERY_FOLLOWUPS_MS,
  shouldRefreshHistoryOnHeartbeat,
} from "../historyRefreshPolicy";

describe("historyRefreshPolicy", () => {
  it("extends approval recovery follow-ups beyond 6 seconds", () => {
    expect(APPROVAL_RECOVERY_FOLLOWUPS_MS[0]).toBe(500);
    expect(APPROVAL_RECOVERY_FOLLOWUPS_MS).toContain(6_000);
    expect(APPROVAL_RECOVERY_FOLLOWUPS_MS).toContain(90_000);
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
});
