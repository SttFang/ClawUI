import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectLatestBySession, selectPendingBySession, useExecApprovalsStore } from "..";

const hoisted = vi.hoisted(() => ({
  requestSpy: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    chat: {
      request: hoisted.requestSpy,
    },
  },
}));

describe("execApprovals store", () => {
  beforeEach(() => {
    hoisted.requestSpy.mockReset();
    hoisted.requestSpy.mockResolvedValue({ ok: true });
  });

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

  it.each(["allow-once", "allow-always"] as const)(
    "should rollback running key when %s resolve request fails",
    async (decision) => {
      const now = Date.now();
      useExecApprovalsStore.setState({
        queue: [
          {
            id: "pending",
            request: { command: "openclaw status", sessionKey: "agent:main:ui:1" },
            createdAtMs: now,
            expiresAtMs: now + 30_000,
          },
        ],
        busyById: {},
        runningByKey: {},
        lastResolvedBySession: {},
      });

      hoisted.requestSpy.mockRejectedValueOnce(new Error("resolve failed"));

      await expect(useExecApprovalsStore.getState().resolve("pending", decision)).rejects.toThrow(
        "resolve failed",
      );

      const state = useExecApprovalsStore.getState();
      expect(state.runningByKey).toEqual({});
      expect(state.busyById).toEqual({});
      expect(state.queue.map((item) => item.id)).toEqual(["pending"]);
    },
  );
});
