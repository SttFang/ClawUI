import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { initialState } from "@/store/execApprovals/initialState";
import { useOpenClawHistorySync } from "../useOpenClawHistorySync";

type GatewayCallback = (frame: GatewayEventFrame) => void;
type NormalizedCallback = (event: ChatNormalizedRunEvent) => void;

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

const hoisted = vi.hoisted(() => ({
  gatewayEventListener: null as GatewayCallback | null,
  normalizedEventListener: null as NormalizedCallback | null,
  requestSpy: vi.fn(async (_method: string) => ({ messages: [] as unknown[] })),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    gateway: {
      onEvent: vi.fn((callback: GatewayCallback) => {
        hoisted.gatewayEventListener = callback;
        return () => {
          hoisted.gatewayEventListener = null;
        };
      }),
      onStatusChange: vi.fn(() => () => {}),
      start: vi.fn(),
      stop: vi.fn(),
      getStatus: vi.fn(async () => "running"),
      installService: vi.fn(),
      restartService: vi.fn(),
      uninstallService: vi.fn(),
    },
    chat: {
      connect: vi.fn(async () => true),
      disconnect: vi.fn(async () => true),
      send: vi.fn(),
      request: hoisted.requestSpy,
      isConnected: vi.fn(async () => false),
      onStream: vi.fn(() => () => {}),
      onConnected: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      onNormalizedEvent: vi.fn((callback: NormalizedCallback) => {
        hoisted.normalizedEventListener = callback;
        return () => {
          hoisted.normalizedEventListener = null;
        };
      }),
    },
    config: {},
    subscription: {},
    onboarding: {},
    app: {},
    state: {},
    usage: {},
    models: {},
    metadata: {},
    skills: {},
    security: {},
    secrets: {},
  },
}));

describe("useOpenClawHistorySync", () => {
  beforeEach(() => {
    vi.useRealTimers();
    useExecApprovalsStore.setState({
      ...initialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
    hoisted.requestSpy.mockClear();
    hoisted.gatewayEventListener = null;
    hoisted.normalizedEventListener = null;
  });

  function mountHook(sessionKey: string, hasSession: boolean) {
    const setMessages = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    const Probe = () => {
      useOpenClawHistorySync({
        sessionKey,
        hasSession,
        setMessages,
      });
      return null;
    };

    act(() => {
      root.render(createElement(Probe));
    });

    return { container, root, setMessages };
  }

  it("forces refresh and follow-up refresh on raw approval.resolved", async () => {
    vi.useFakeTimers();
    const sessionKey = "agent:main:ui:history-force";

    const { root } = mountHook(sessionKey, true);
    await act(async () => {
      await Promise.resolve();
    });

    hoisted.requestSpy.mockClear();

    await act(async () => {
      expect(hoisted.gatewayEventListener).toBeTypeOf("function");
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-id-1",
          sessionKey,
          decision: "allow-once",
        },
      });
      await Promise.resolve();
    });

    expect(hoisted.requestSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(2);
    act(() => {
      root.unmount();
    });
  });

  it("triggers raw approval.resolved recovery refresh without normalized context", async () => {
    vi.useFakeTimers();
    const sessionKey = "agent:main:ui:history-fallback";

    const { root } = mountHook(sessionKey, true);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });

    hoisted.requestSpy.mockClear();

    await act(async () => {
      expect(hoisted.gatewayEventListener).toBeTypeOf("function");
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-id-2",
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(hoisted.requestSpy).toHaveBeenCalledTimes(2);
    act(() => {
      root.unmount();
    });
  });

  it("keeps recovery refresh active at 5s, 30s, 90s heartbeat checkpoints", async () => {
    vi.useFakeTimers();
    const sessionKey = "agent:main:ui:history-5-30-90";

    const { root } = mountHook(sessionKey, true);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });

    hoisted.requestSpy.mockClear();

    await act(async () => {
      expect(hoisted.gatewayEventListener).toBeTypeOf("function");
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-id-3",
          sessionKey,
          decision: "allow-once",
        },
      });
      await Promise.resolve();
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_750);
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "heartbeat",
        payload: {},
      });
      await Promise.resolve();
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "heartbeat",
        payload: {},
      });
      await Promise.resolve();
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "heartbeat",
        payload: {},
      });
      await Promise.resolve();
    });
    expect(hoisted.requestSpy).toHaveBeenCalledTimes(5);

    act(() => {
      root.unmount();
    });
  });

  it("clears running state when normalized tool_finished uses bash", async () => {
    const sessionKey = "agent:main:ui:bash-finished";
    useExecApprovalsStore.setState((state) => ({
      ...state,
      runningByKey: {
        [`${sessionKey}::ls -la`]: Date.now(),
      },
    }));

    const { root } = mountHook(sessionKey, true);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      hoisted.normalizedEventListener?.({
        kind: "run.tool_finished",
        traceId: "trace-bash-finished",
        timestampMs: Date.now(),
        sessionKey,
        clientRunId: "run-bash-finished",
        metadata: { name: "bash", phase: "result" },
      });
    });

    expect(useExecApprovalsStore.getState().runningByKey[`${sessionKey}::ls -la`]).toBeUndefined();

    act(() => {
      root.unmount();
    });
  });

  it("does not throttle immediate heartbeat retry after a failed refresh", async () => {
    vi.useFakeTimers();
    const sessionKey = "agent:main:ui:heartbeat-retry-after-fail";
    const now = Date.now();
    useExecApprovalsStore.setState((state) => ({
      ...state,
      queue: [
        {
          id: "approval-heartbeat-retry",
          request: { sessionKey, command: "ls -la" },
          createdAtMs: now,
          expiresAtMs: now + 120_000,
        },
      ],
      runningByKey: {},
    }));

    let historyCalls = 0;
    hoisted.requestSpy.mockImplementation(async (method: string) => {
      if (method !== "chat.history") return { messages: [] as unknown[] };
      historyCalls += 1;
      if (historyCalls === 2) {
        throw new Error("temporary history failure");
      }
      return { messages: [] as unknown[] };
    });

    const { root } = mountHook(sessionKey, true);
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(historyCalls).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_600);
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "heartbeat",
        payload: {},
      });
      await Promise.resolve();
    });
    expect(historyCalls).toBe(2);

    await act(async () => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "heartbeat",
        payload: {},
      });
      await Promise.resolve();
    });
    expect(historyCalls).toBe(3);

    act(() => {
      root.unmount();
    });
  });
});
