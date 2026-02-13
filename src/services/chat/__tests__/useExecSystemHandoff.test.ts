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
    hoisted.requestSpy.mockReset();
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") return { messages: historyMessages };
        return { ok: true };
      },
    );
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
    historyMessages = [
      {
        id: "sys-terminal-1",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0)" }],
        createdAtMs: Date.now(),
      },
    ];

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
      message: "System: Exec finished (code 0)",
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
    historyMessages = [
      {
        id: "sys-terminal-2",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0)" }],
        createdAtMs: Date.now(),
      },
    ];

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

  it("should handoff terminal system text from chat events", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "chat",
        payload: {
          sessionKey: "s1",
          runId: "run-chat-finished",
          state: "final",
          message: {
            content: [{ type: "text", text: "System: Exec finished (code 0)" }],
          },
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
      message: "System: Exec finished (code 0)",
      inputProvenance: { source: "agent-tool-terminal", runId: "run-chat-finished" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should skip regular user history text and fallback to allowed roles", async () => {
    const now = Date.now();
    historyMessages = [
      {
        id: "assistant-old",
        role: "assistant",
        content: [{ type: "text", text: "older assistant text" }],
        createdAtMs: now - 1_000,
      },
      {
        id: "user-latest",
        role: "user",
        content: [{ type: "text", text: "latest user text should not handoff" }],
        createdAtMs: now,
      },
    ];

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-unknown",
          decision: "unexpected-decision",
          request: { sessionKey: "s1" },
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
      message: "older assistant text",
      inputProvenance: { source: "approval-unknown" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should allow retry after first agent request failure", async () => {
    let agentAttempt = 0;
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") return { messages: historyMessages };
        if (method === "agent") {
          agentAttempt += 1;
          if (agentAttempt === 1) throw new Error("network failed");
        }
        return { ok: true };
      },
    );

    const { root } = mountHook("s1", true);

    const emitToolResult = () => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "agent",
        payload: {
          sessionKey: "s1",
          runId: "run-1",
          stream: "tool",
          data: {
            name: "exec",
            phase: "result",
            result: "command done",
          },
        },
      });
    };

    act(() => {
      emitToolResult();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    act(() => {
      emitToolResult();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(2);

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
