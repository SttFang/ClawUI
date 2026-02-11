import { describe, expect, it } from "vitest";
import { ChatEventNormalizer } from "../../../../electron/main/services/chat-event-normalizer";

describe("ChatEventNormalizer", () => {
  it("consumes approval pending only once after resolved", () => {
    const normalizer = new ChatEventNormalizer();
    const sessionKey = "agent:main:ui:test";

    normalizer.onChatSendAccepted({
      sessionKey,
      clientRunId: "client-run-1",
    });

    normalizer.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "approval-1",
        request: {
          sessionKey,
          command: "ls -la",
        },
      },
    });

    const firstResolved = normalizer.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-1",
        decision: "allow-once",
      },
    });
    const secondResolved = normalizer.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "approval-1",
        decision: "allow-once",
      },
    });

    expect(firstResolved).toHaveLength(1);
    expect(firstResolved[0]?.kind).toBe("run.approval_resolved");
    expect(secondResolved).toEqual([]);
  });

  it("maps chat.final using agent run id when client run id is absent", () => {
    const normalizer = new ChatEventNormalizer();
    const sessionKey = "agent:main:ui:test";
    const [started] = normalizer.onChatSendAccepted({
      sessionKey,
      clientRunId: "client-run-2",
    });

    const lifecycle = normalizer.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        sessionKey,
        runId: "agent-run-2",
        stream: "lifecycle",
        data: { phase: "start" },
      },
    });

    const finalEvents = normalizer.ingestGatewayEvent({
      type: "event",
      event: "chat",
      payload: {
        sessionKey,
        runId: "agent-run-2",
        state: "final",
        message: {
          content: [{ type: "text", text: "done" }],
        },
      },
    });

    expect(lifecycle[0]?.kind).toBe("run.lifecycle");
    expect(finalEvents[0]?.kind).toBe("run.completed");
    expect(finalEvents[0]?.traceId).toBe(started?.traceId);
  });

  it("does not drop agent lifecycle events during approval recovery", () => {
    const normalizer = new ChatEventNormalizer();
    const sessionKey = "agent:main:ui:test";

    normalizer.ingestGatewayEvent({
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "approval-2",
        request: {
          sessionKey,
          command: "python3 script.py",
        },
      },
    });

    const lifecycle = normalizer.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        sessionKey,
        runId: "agent-run-3",
        stream: "lifecycle",
        data: { phase: "end" },
      },
    });

    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0]?.kind).toBe("run.lifecycle");
  });

  it("normalizes tool_use_id into metadata.toolCallId", () => {
    const normalizer = new ChatEventNormalizer();
    const sessionKey = "agent:main:ui:test";
    normalizer.onChatSendAccepted({
      sessionKey,
      clientRunId: "client-run-tool",
    });

    const events = normalizer.ingestGatewayEvent({
      type: "event",
      event: "agent",
      payload: {
        sessionKey,
        runId: "client-run-tool",
        stream: "tool",
        data: {
          phase: "start",
          name: "exec",
          tool_use_id: "call-use-1",
        },
      },
    });

    expect(events[0]?.kind).toBe("run.tool_started");
    const metadata = (events[0]?.metadata ?? {}) as { toolCallId?: unknown };
    expect(metadata.toolCallId).toBe("call-use-1");
  });
});
