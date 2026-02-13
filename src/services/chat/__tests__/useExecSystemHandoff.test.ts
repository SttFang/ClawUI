import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";
import { useExecSystemHandoff } from "../useExecSystemHandoff";

type GatewayCallback = (frame: GatewayEventFrame) => void;
type NormalizedCallback = (event: ChatNormalizedRunEvent) => void;

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

let historyMessages: unknown[] = [];

const hoisted = vi.hoisted(() => ({
  gatewayEventListener: null as GatewayCallback | null,
  normalizedEventListener: null as NormalizedCallback | null,
  requestSpy: vi.fn(async (method: string, _params?: Record<string, unknown>) => {
    if (method === "chat.history") return { messages: historyMessages };
    return { ok: true };
  }),
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
    },
    chat: {
      request: hoisted.requestSpy,
      onNormalizedEvent: vi.fn((callback: NormalizedCallback) => {
        hoisted.normalizedEventListener = callback;
        return () => {
          hoisted.normalizedEventListener = null;
        };
      }),
    },
  },
}));

describe("useExecSystemHandoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    historyMessages = [];
    hoisted.requestSpy.mockClear();
    hoisted.gatewayEventListener = null;
    hoisted.normalizedEventListener = null;
  });

  function mountHook(sessionKey: string, hasSession: boolean) {
    const container = document.createElement("div");
    const root = createRoot(container);
    const Probe = () => {
      useExecSystemHandoff({ sessionKey, hasSession });
      return null;
    };
    act(() => {
      root.render(createElement(Probe));
    });
    return { root };
  }

  it("should handoff approval-resolved once and call agent with internal provenance", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.normalizedEventListener?.({
        kind: "run.started",
        traceId: "trace-1",
        timestampMs: Date.now(),
        sessionKey: "s1",
        clientRunId: "run-1",
      });
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-1",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "openclaw status" },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]?.[1]).toMatchObject({
      sessionKey: "s1",
      message: "Execution approved for: openclaw status",
      inputProvenance: {
        kind: "internal_system",
        sourceSessionKey: "s1",
        runId: "run-1",
        source: "approval-allow",
      },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should dedupe duplicated approval events in cooldown window", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-2",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la" },
        },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-2-repeat",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la" },
        },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);

    act(() => {
      root.unmount();
    });
  });

  it("should handoff deny and timeout decisions", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-deny",
          decision: "deny",
          request: { sessionKey: "s1", command: "python bad.py" },
        },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-timeout",
          decision: "timeout",
          request: { sessionKey: "s1", command: "python slow.py" },
        },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(2);
    expect(agentCalls[0]?.[1]).toMatchObject({
      message: "Execution denied for command: python bad.py",
      inputProvenance: { source: "approval-deny" },
    });
    expect(agentCalls[1]?.[1]).toMatchObject({
      message: "Execution timed out while waiting for approval.",
      inputProvenance: { source: "approval-timeout" },
    });

    act(() => {
      root.unmount();
    });
  });
});
