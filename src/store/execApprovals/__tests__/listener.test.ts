import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayEventFrame } from "@/lib/ipc";
import { EXEC_RUNNING_TTL_MS } from "../helpers";
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

  it("marks command as running when allow decision is resolved from gateway", () => {
    const now = Date.now();
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [
        {
          id: "pending-running",
          request: { sessionKey: "agent:main:ui:1", command: "ls -la ~/Desktop" },
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
        id: "pending-running",
        decision: "allowlist",
        request: {
          id: "pending-running",
          sessionKey: "agent:main:ui:1",
          command: "ls -la ~/Desktop",
        },
        ts: 300,
      },
    });

    const state = useExecApprovalsStore.getState();
    expect(state.runningByKey["agent:main:ui:1::ls -la ~/Desktop"]).toBe(300);
    expect(state.lastResolvedBySession["agent:main:ui:1"]).toEqual({
      id: "pending-running",
      decision: "allow-always",
      atMs: 300,
    });
    expect(state.queue).toEqual([]);
  });

  it("does not clear running on exec phase=end without result payload", () => {
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [],
      busyById: {},
      runningByKey: {
        "agent:main:ui:1::ls -la ~/Desktop": 400,
      },
      lastResolvedBySession: {},
    });

    hoisted.gatewayHandler?.({
      type: "event",
      event: "agent",
      payload: {
        stream: "tool",
        sessionKey: "agent:main:ui:1",
        data: {
          name: "exec",
          phase: "end",
          args: {
            command: "ls -la ~/Desktop",
          },
        },
      },
    });

    const state = useExecApprovalsStore.getState();
    expect(state.runningByKey["agent:main:ui:1::ls -la ~/Desktop"]).toBe(400);
  });

  it("clears running markers when chat run reaches terminal state", () => {
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [],
      busyById: {},
      runningByKey: {
        "agent:main:ui:1::ls -la ~/Desktop": 500,
        "agent:main:ui:2::pwd": 600,
      },
      lastResolvedBySession: {},
    });

    hoisted.gatewayHandler?.({
      type: "event",
      event: "chat",
      payload: {
        sessionKey: "agent:main:ui:1",
        runId: "run-chat-final",
        state: "final",
      },
    });

    const state = useExecApprovalsStore.getState();
    expect(state.runningByKey["agent:main:ui:1::ls -la ~/Desktop"]).toBeUndefined();
    expect(state.runningByKey["agent:main:ui:2::pwd"]).toBe(600);
  });

  it("auto clears gateway-marked running command after ttl", async () => {
    vi.useFakeTimers();
    const now = Date.now();

    useExecApprovalsStore.setState({
      ...initialState,
      queue: [
        {
          id: "pending-ttl",
          request: { sessionKey: "agent:main:ui:1", command: "ls -la ~/Desktop" },
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
        id: "pending-ttl",
        decision: "allow-once",
        request: {
          id: "pending-ttl",
          sessionKey: "agent:main:ui:1",
          command: "ls -la ~/Desktop",
        },
        ts: now,
      },
    });

    expect(useExecApprovalsStore.getState().runningByKey["agent:main:ui:1::ls -la ~/Desktop"]).toBe(
      now,
    );

    vi.setSystemTime(now + EXEC_RUNNING_TTL_MS + 1500);
    await vi.advanceTimersByTimeAsync(EXEC_RUNNING_TTL_MS + 1500);

    expect(
      useExecApprovalsStore.getState().runningByKey["agent:main:ui:1::ls -la ~/Desktop"],
    ).toBeUndefined();
    vi.useRealTimers();
  });
});
