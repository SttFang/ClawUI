import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatEventAdapter } from "../event-adapter";

describe("ChatEventAdapter approval recovery", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("keeps approval correlation after delayed exec.approval.resolved", () => {
    const start = new Date("2026-02-13T00:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(start);

    const adapter = new ChatEventAdapter();
    adapter.onChatSendAccepted({
      sessionKey: "session-1",
      clientRunId: "client-run-1",
    });

    const requested = adapter.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "approval-delayed",
        sessionKey: "session-1",
      },
    });
    expect(requested).toHaveLength(1);
    expect(requested[0].kind).toBe("run.waiting_approval");

    vi.setSystemTime(start + 90_000);
    const resolved = adapter.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-delayed",
        sessionKey: "session-1",
      },
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].kind).toBe("run.approval_resolved");
    expect(resolved[0].correlationConfidence).toBe("exact");
  });

  it("falls back to recent active run when consumeApproval misses", () => {
    const adapter = new ChatEventAdapter();

    const requested = adapter.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "approval-no-session",
      },
    });
    expect(requested).toHaveLength(0);

    adapter.onChatSendAccepted({
      sessionKey: "session-fallback",
      clientRunId: "client-run-fallback",
    });
    const resolved = adapter.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-no-session",
      },
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].kind).toBe("run.approval_resolved");
    expect(resolved[0].correlationConfidence).toBe("fallback");
    expect(resolved[0].sessionKey).toBe("session-fallback");
  });

  it("recovers approval resolve from direct request context when pending approval is missing", () => {
    const adapter = new ChatEventAdapter();
    adapter.onChatSendAccepted({
      sessionKey: "session-direct-resolve",
      clientRunId: "client-run-direct-resolve",
    });

    const resolved = adapter.onApprovalResolveRequest({
      approvalId: "approval-direct-resolve",
      decision: "allow-once",
      sessionKey: "session-direct-resolve",
      commandHint: "python3 -c \"print('ok')\"",
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].kind).toBe("run.approval_resolved");
    expect(resolved[0].correlationConfidence).toBe("fallback");
    expect(resolved[0].sessionKey).toBe("session-direct-resolve");
    expect(resolved[0].command).toBe("python3 -c \"print('ok')\"");
  });
});

describe("ChatEventAdapter compaction events", () => {
  it("emits run.lifecycle for compaction start", () => {
    const adapter = new ChatEventAdapter();
    adapter.onChatSendAccepted({
      sessionKey: "session-compact",
      clientRunId: "client-run-compact",
    });

    const events = adapter.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        runId: "agent-run-1",
        sessionKey: "session-compact",
        stream: "compaction",
        data: { phase: "start" },
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("run.lifecycle");
    expect(events[0].rawEventName).toBe("agent.compaction");
    expect(events[0].metadata).toEqual({
      stream: "compaction",
      phase: "start",
      willRetry: undefined,
    });
  });

  it("emits run.lifecycle for compaction end with willRetry", () => {
    const adapter = new ChatEventAdapter();
    adapter.onChatSendAccepted({
      sessionKey: "session-compact",
      clientRunId: "client-run-compact",
    });

    const events = adapter.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        runId: "agent-run-1",
        sessionKey: "session-compact",
        stream: "compaction",
        data: { phase: "end", willRetry: true },
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("run.lifecycle");
    expect(events[0].rawEventName).toBe("agent.compaction");
    expect(events[0].metadata).toEqual({
      stream: "compaction",
      phase: "end",
      willRetry: true,
    });
  });

  it("emits run.lifecycle for compaction end without retry", () => {
    const adapter = new ChatEventAdapter();
    adapter.onChatSendAccepted({
      sessionKey: "session-compact",
      clientRunId: "client-run-compact",
    });

    const events = adapter.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        runId: "agent-run-1",
        sessionKey: "session-compact",
        stream: "compaction",
        data: { phase: "end", willRetry: false },
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({
      stream: "compaction",
      phase: "end",
      willRetry: false,
    });
  });
});
