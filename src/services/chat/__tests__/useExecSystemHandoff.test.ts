import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";
import { initialState as a2uiExecTraceInitialState } from "@/store/a2uiExecTrace/initialState";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { initialState as execApprovalsInitialState } from "@/store/execApprovals/initialState";
import { useExecApprovalsStore } from "@/store/execApprovals/store";
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
    useExecApprovalsStore.setState({
      ...execApprovalsInitialState,
      queue: [],
      busyById: {},
      runningByKey: {},
      lastResolvedBySession: {},
    });
    useA2UIExecTraceStore.setState({
      ...a2uiExecTraceInitialState,
      tracesByKey: {},
      terminalByCommand: {},
    });
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
      hoisted.normalizedEventListener?.({
        kind: "run.approval_resolved",
        traceId: "trace-approval-1",
        timestampMs: Date.now(),
        sessionKey: "s1",
        clientRunId: "run-1",
        decision: "allow-once",
        command: "openclaw status",
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
        sourceTool: "approval-allow",
      },
    });
    expect(typeof (agentCalls[0]?.[1] as { idempotencyKey?: unknown })?.idempotencyKey).toBe(
      "string",
    );

    act(() => {
      root.unmount();
    });
  });

  it("should dedupe duplicated approval events in cooldown window", async () => {
    historyMessages = [
      {
        id: "sys-terminal-2",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0) ls -la" }],
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
    const now = Date.now();
    useExecApprovalsStore.setState((state) => ({
      ...state,
      runningByKey: {
        "s1::ls -la ~/Desktop": now,
      },
    }));
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
      inputProvenance: { sourceTool: "agent-tool-terminal" },
    });
    expect(useExecApprovalsStore.getState().runningByKey["s1::ls -la ~/Desktop"]).toBeUndefined();
    const terminalFromChat =
      useA2UIExecTraceStore.getState().terminalByCommand["s1::ls -la ~/Desktop"];
    expect(terminalFromChat).toBeDefined();

    act(() => {
      root.unmount();
    });
  });

  it("should handoff assistant terminal text without payload.sessionKey when runId matches", async () => {
    const now = Date.now();
    useExecApprovalsStore.setState((state) => ({
      ...state,
      runningByKey: {
        "s1::ls -la ~/Desktop": now,
      },
    }));

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.normalizedEventListener?.({
        kind: "run.started",
        traceId: "trace-assistant-fallback",
        timestampMs: now,
        sessionKey: "s1",
        clientRunId: "run-assistant-fallback",
      });
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "agent",
        payload: {
          runId: "run-assistant-fallback",
          stream: "assistant",
          data: {
            text: "System: Exec finished (gateway id=e2e, code 0) ok",
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
      message: "System: Exec finished (gateway id=e2e, code 0) ok",
      inputProvenance: { sourceTool: "agent-tool-terminal" },
    });
    expect(useExecApprovalsStore.getState().runningByKey["s1::ls -la ~/Desktop"]).toBeUndefined();
    const terminalFromAssistant =
      useA2UIExecTraceStore.getState().terminalByCommand["s1::ls -la ~/Desktop"];
    expect(terminalFromAssistant).toBeDefined();

    act(() => {
      root.unmount();
    });
  });

  it("should retry approval-allow handoff when terminal result appears later", async () => {
    let historyCalls = 0;
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") {
          historyCalls += 1;
          if (historyCalls === 1) {
            return {
              messages: [
                {
                  id: "sys-pending",
                  role: "system",
                  content: [{ type: "text", text: "Approval required (id=abc)." }],
                  createdAtMs: Date.now(),
                },
              ],
            };
          }
          return {
            messages: [
              {
                id: "sys-finished",
                role: "system",
                content: [
                  {
                    type: "text",
                    text: "drwxr-xr-x  90 fanghanjun staff 2880 Feb 3 16:23 激活-教育",
                  },
                ],
                createdAtMs: Date.now(),
              },
            ],
          };
        }
        return { ok: true };
      },
    );

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-retry-1",
          decision: "allowlist",
          request: { sessionKey: "s1", command: "ls -la ~/Desktop" },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    let agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    const nudgePayload = agentCalls[0]?.[1] as { message?: string } | undefined;
    expect(nudgePayload?.message).toContain("[internal.exec.approval.allow]");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
    });

    agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(2);
    expect(agentCalls[1]?.[1]).toMatchObject({
      sessionKey: "s1",
      message: "drwxr-xr-x 90 fanghanjun staff 2880 Feb 3 16:23 激活-教育",
      inputProvenance: { sourceTool: "approval-allow" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should fallback to last-heartbeat preview when history has no terminal result yet", async () => {
    let lastHeartbeatCalls = 0;
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") {
          return {
            messages: [
              {
                id: "sys-pending-only",
                role: "system",
                content: [{ type: "text", text: "Approval required (id=abc)." }],
                createdAtMs: Date.now(),
              },
            ],
          };
        }
        if (method === "last-heartbeat") {
          lastHeartbeatCalls += 1;
          return {
            ok: true,
            ts: Date.now(),
            reason: "exec-event",
            status: "skipped",
            preview: "Exec finished (gateway id=e2e, code 0) ok",
          };
        }
        return { ok: true };
      },
    );

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-heartbeat-fallback",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "python3 -c \"print('ok')\"" },
          ts: Date.now(),
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(lastHeartbeatCalls).toBe(1);
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]?.[1]).toMatchObject({
      sessionKey: "s1",
      message: "Exec finished (gateway id=e2e, code 0) ok",
      inputProvenance: { sourceTool: "approval-allow" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should nudge internal loop when approval is allowed but terminal result is still unavailable", async () => {
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") {
          return {
            messages: [
              {
                id: "sys-pending-only",
                role: "system",
                content: [{ type: "text", text: "Approval required (id=nudge)." }],
                createdAtMs: Date.now(),
              },
            ],
          };
        }
        if (method === "last-heartbeat") {
          return {
            ok: true,
            ts: Date.now(),
            reason: "idle",
            status: "ok",
            preview: "",
          };
        }
        return { ok: true };
      },
    );

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-loop-nudge",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la ~/Desktop" },
          ts: Date.now(),
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });
    let agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]?.[1]).toMatchObject({
      sessionKey: "s1",
      inputProvenance: { sourceTool: "approval-allow" },
    });
    const firstAgentPayload = agentCalls[0]?.[1] as { message?: string } | undefined;
    expect(firstAgentPayload?.message).toContain("[internal.exec.approval.allow]");
    expect(firstAgentPayload?.message).toContain("---");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
      await Promise.resolve();
    });
    agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.resolve();
    });
    agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);

    act(() => {
      root.unmount();
    });
  });

  it("should preserve normalized approval command when raw resolved payload omits session and command", async () => {
    hoisted.requestSpy.mockImplementation(
      async (method: string, _params?: Record<string, unknown>) => {
        if (method === "chat.history") {
          return {
            messages: [
              {
                id: "sys-pending-only-merge",
                role: "system",
                content: [{ type: "text", text: "Approval required (id=merge)." }],
                createdAtMs: Date.now(),
              },
            ],
          };
        }
        if (method === "last-heartbeat") {
          return {
            ok: true,
            ts: Date.now(),
            reason: "idle",
            status: "ok",
            preview: "",
          };
        }
        return { ok: true };
      },
    );

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.normalizedEventListener?.({
        kind: "run.approval_resolved",
        traceId: "trace-approval-merge",
        timestampMs: Date.now(),
        sessionKey: "s1",
        clientRunId: "run-approval-merge",
        approvalId: "approval-merge",
        decision: "allow-once",
        command: "ls -la ~/Desktop",
      });
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-merge",
          decision: "allow-once",
          ts: Date.now(),
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    const payload = agentCalls[0]?.[1] as
      | { message?: string; inputProvenance?: unknown }
      | undefined;
    expect(payload?.message).toContain("command: ls -la ~/Desktop");
    expect(payload?.message).not.toContain("command: <unknown>");
    expect(payload?.inputProvenance).toMatchObject({ sourceTool: "approval-allow" });

    act(() => {
      root.unmount();
    });
  });

  it("should prefer latest terminal history text over newer non-terminal assistant text", async () => {
    const now = Date.now();
    historyMessages = [
      {
        id: "sys-finished-older",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0) ls -la ~/Desktop" }],
        createdAtMs: now - 1000,
      },
      {
        id: "assistant-newer",
        role: "assistant",
        content: [{ type: "text", text: "结果：你的桌面已经很干净了。" }],
        createdAtMs: now,
      },
    ];

    const { root } = mountHook("s1", true);
    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-terminal-priority",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la ~/Desktop" },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]?.[1]).toMatchObject({
      message: "System: Exec finished (code 0) ls -la ~/Desktop",
      inputProvenance: { sourceTool: "approval-allow" },
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
      inputProvenance: { sourceTool: "approval-unknown" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should not handoff stale terminal text older than approval resolve time", async () => {
    const now = Date.now();
    historyMessages = [
      {
        id: "sys-old-terminal",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0) ls -la ~/Desktop" }],
        createdAtMs: now - 10_000,
      },
    ];

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-stale",
          ts: now,
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la ~/Desktop" },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(1);
    const nudgePayload = agentCalls[0]?.[1] as { message?: string } | undefined;
    expect(nudgePayload?.message).toContain("[internal.exec.approval.allow]");

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
      inputProvenance: { sourceTool: "approval-deny" },
    });
    expect(agentCalls[1]?.[1]).toMatchObject({
      message: "Execution timed out while waiting for approval.",
      inputProvenance: { sourceTool: "approval-timeout" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should handoff approval resolved even when payload session differs from currently selected session", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-cross-session",
          decision: "deny",
          request: { sessionKey: "s2", command: "ls -la ~/Desktop" },
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
      sessionKey: "s2",
      message: "Execution denied for command: ls -la ~/Desktop",
      inputProvenance: { sourceTool: "approval-deny" },
    });

    act(() => {
      root.unmount();
    });
  });

  it("should mark command terminal and clear running key after approval allow handoff", async () => {
    const now = Date.now();
    useExecApprovalsStore.setState((state) => ({
      ...state,
      runningByKey: {
        "s1::ls -la ~/Desktop": now,
      },
    }));
    historyMessages = [
      {
        id: "sys-finished-generic",
        role: "system",
        content: [
          { type: "text", text: "drwxr-xr-x 90 fanghanjun staff 2880 Feb 3 16:23 激活-教育" },
        ],
        createdAtMs: now + 1000,
      },
    ];

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-clear-running",
          decision: "allow-always",
          request: { sessionKey: "s1", command: "ls -la ~/Desktop" },
          ts: now + 500,
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    expect(useExecApprovalsStore.getState().runningByKey["s1::ls -la ~/Desktop"]).toBeUndefined();
    const terminal = useA2UIExecTraceStore.getState().terminalByCommand["s1::ls -la ~/Desktop"];
    expect(terminal).toBeDefined();
    expect(typeof terminal?.traceKey).toBe("string");

    act(() => {
      root.unmount();
    });
  });

  it("should not handoff tool end phase without terminal payload", async () => {
    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "agent",
        payload: {
          sessionKey: "s1",
          runId: "run-end-no-result",
          stream: "tool",
          data: {
            name: "exec",
            phase: "end",
          },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(agentCalls).toHaveLength(0);

    act(() => {
      root.unmount();
    });
  });

  it("should ignore tool payload without session/run/command correlation", async () => {
    useExecApprovalsStore.setState((state) => ({
      ...state,
      queue: [
        {
          id: "approval-pending",
          request: { sessionKey: "s1", command: "ls -la" },
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 60_000,
        },
      ],
    }));

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "agent",
        payload: {
          runId: "run-other-session",
          stream: "tool",
          data: {
            name: "exec",
            phase: "result",
            result: "other session output",
          },
        },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
      await Promise.resolve();
    });

    const historyCalls = hoisted.requestSpy.mock.calls.filter(
      ([method]) => method === "chat.history",
    );
    const agentCalls = hoisted.requestSpy.mock.calls.filter(([method]) => method === "agent");
    expect(historyCalls).toHaveLength(0);
    expect(agentCalls).toHaveLength(0);

    act(() => {
      root.unmount();
    });
  });

  it("should allow repeated handoff after cooldown expires", async () => {
    historyMessages = [
      {
        id: "sys-terminal-cooldown",
        role: "system",
        content: [{ type: "text", text: "System: Exec finished (code 0) ls -la" }],
        createdAtMs: Date.now(),
      },
    ];

    const { root } = mountHook("s1", true);

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-cooldown-1",
          decision: "allow-once",
          request: { sessionKey: "s1", command: "ls -la" },
        },
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_001);
    });

    act(() => {
      hoisted.gatewayEventListener?.({
        type: "event",
        event: "exec.approval.resolved",
        payload: {
          id: "approval-cooldown-2",
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
    expect(agentCalls).toHaveLength(2);

    act(() => {
      root.unmount();
    });
  });
});
