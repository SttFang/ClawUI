import { describe, expect, it } from "vitest";
import { selectLatestBySession, selectPendingBySession, useExecApprovalsStore } from "..";

describe("execApprovals store", () => {
  it("should pick latest pending approval for same session", () => {
    const now = Date.now();
    useExecApprovalsStore.setState({
      queue: [
        {
          id: "old",
          request: { command: "echo old", sessionKey: "agent:main:ui:1" },
          createdAtMs: now - 1_000,
          expiresAtMs: now + 30_000,
        },
        {
          id: "new",
          request: { command: "echo new", sessionKey: "agent:main:ui:1" },
          createdAtMs: now,
          expiresAtMs: now + 30_000,
        },
        {
          id: "other",
          request: { command: "echo other", sessionKey: "agent:main:ui:2" },
          createdAtMs: now + 100,
          expiresAtMs: now + 30_000,
        },
      ],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });

    const state = useExecApprovalsStore.getState();
    const pending = selectPendingBySession(state, "agent:main:ui:1");
    const latest = selectLatestBySession(state, "agent:main:ui:1");

    expect(pending.map((item) => item.id)).toEqual(["new", "old"]);
    expect(latest?.id).toBe("new");
    expect(selectPendingBySession(state, "")).toEqual([]);
  });

  it("should clear running keys for a finished session", () => {
    useExecApprovalsStore.setState({
      queue: [],
      busyById: {},
      runningByKey: {
        "agent:main:ui:1::cmd-a": Date.now(),
        "agent:main:ui:1::cmd-b": Date.now(),
        "agent:main:ui:2::cmd-c": Date.now(),
      },
      lastResolvedBySession: {},
    });

    useExecApprovalsStore.getState().clearRunningForSession("agent:main:ui:1");

    expect(useExecApprovalsStore.getState().runningByKey).toEqual({
      "agent:main:ui:2::cmd-c": expect.any(Number),
    });
  });
});
