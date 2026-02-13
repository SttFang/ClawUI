import { act } from "react-dom/test-utils";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";
import { useOpenClawHistorySync } from "../useOpenClawHistorySync";
import { useExecApprovalsStore } from "@/store/execApprovals";
import { initialState } from "@/store/execApprovals/initialState";

type GatewayCallback = (frame: GatewayEventFrame) => void;
type NormalizedCallback = (event: ChatNormalizedRunEvent) => void;

let gatewayEventListener: GatewayCallback | null = null;
let normalizedEventListener: NormalizedCallback | null = null;
const requestSpy = vi.fn(async () => ({ messages: [] as unknown[] }));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    gateway: {
      onEvent: vi.fn((callback: GatewayCallback) => {
        gatewayEventListener = callback;
        return () => {
          gatewayEventListener = null;
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
      request: requestSpy,
      isConnected: vi.fn(async () => false),
      onStream: vi.fn(() => () => {}),
      onConnected: vi.fn(() => () => {}),
      onDisconnected: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
      onNormalizedEvent: vi.fn((callback: NormalizedCallback) => {
        normalizedEventListener = callback;
        return () => {
          normalizedEventListener = null;
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
    requestSpy.mockClear();
    gatewayEventListener = null;
    normalizedEventListener = null;
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

    requestSpy.mockClear();

    await act(async () => {
      expect(gatewayEventListener).toBeTypeOf("function");
      gatewayEventListener?.({
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

    expect(requestSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(requestSpy).toHaveBeenCalledTimes(2);
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
      requestSpy.mockClear();
      expect(normalizedEventListener).toBeTypeOf("function");
      expect(gatewayEventListener).toBeTypeOf("function");
      normalizedEventListener?.({
        kind: "run.approval_resolved",
        sessionKey,
        traceId: "trace-1",
        timestampMs: Date.now(),
        clientRunId: "client-run-1",
        status: "running",
        source: "gateway",
        correlationConfidence: "exact",
      } as ChatNormalizedRunEvent);
      gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-id-2",
        },
      });
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
    });

    expect(requestSpy).toHaveBeenCalledTimes(2);
    act(() => {
      root.unmount();
    });
  });
});
