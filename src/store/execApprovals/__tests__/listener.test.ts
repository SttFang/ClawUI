import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayEventFrame } from "@/lib/ipc";
import { initialState } from "../initialState";
import { initExecApprovalsListener } from "../listener";
import { useExecApprovalsStore } from "../store";

const hoisted = vi.hoisted(() => ({
  gatewayHandler: null as ((event: GatewayEventFrame) => void) | null,
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    gateway: {
      onEvent: vi.fn((handler: (event: GatewayEventFrame) => void) => {
        hoisted.gatewayHandler = handler;
        return () => {
          hoisted.gatewayHandler = null;
        };
      }),
    },
  },
}));

describe("execApprovals listener", () => {
  beforeAll(() => {
    initExecApprovalsListener();
  });

  beforeEach(() => {
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
  });

  it("resolves pending approval when payload only provides request.id", () => {
    const now = Date.now();
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [
        {
          id: "pending-1",
          request: { sessionKey: "agent:main:ui:1", command: "openclaw status" },
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        },
      ],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });

    hoisted.gatewayHandler?.({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        request: {
          id: "pending-1",
          sessionKey: "agent:main:ui:1",
          command: "openclaw status",
        },
        decision: "allow-once",
        ts: 100,
      },
    });

    const state = useExecApprovalsStore.getState();
    expect(state.queue).toEqual([]);
    expect(state.lastResolvedBySession["agent:main:ui:1"]).toEqual({
      id: "pending-1",
      decision: "allow-once",
      atMs: 100,
    });
  });

  it("falls back to session+command matching when resolved id misses queue", () => {
    const now = Date.now();
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [
        {
          id: "pending-old",
          request: { sessionKey: "agent:main:ui:1", command: "openclaw status" },
          createdAtMs: now - 2_000,
          expiresAtMs: now + 60_000,
        },
        {
          id: "pending-new",
          request: { sessionKey: "agent:main:ui:1", command: "openclaw status" },
          createdAtMs: now - 1_000,
          expiresAtMs: now + 60_000,
        },
        {
          id: "pending-other",
          request: { sessionKey: "agent:main:ui:2", command: "pwd" },
          createdAtMs: now,
          expiresAtMs: now + 60_000,
        },
      ],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });

    hoisted.gatewayHandler?.({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-unknown",
        sessionKey: "agent:main:ui:1",
        command: "openclaw status",
        decision: "allow-always",
        ts: 200,
      },
    });

    const state = useExecApprovalsStore.getState();
    expect(state.queue.map((item) => item.id)).toEqual(["pending-old", "pending-other"]);
    expect(state.lastResolvedBySession["agent:main:ui:1"]).toEqual({
      id: "pending-new",
      decision: "allow-always",
      atMs: 200,
    });
  });
});
