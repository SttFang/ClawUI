import { describe, expect, it, vi } from "vitest";
import { ChatWebSocketService } from "../chat-websocket";

describe("ChatWebSocketService request", () => {
  it("sanitizes exec.approval.resolve params sent to gateway transport", async () => {
    const service = new ChatWebSocketService() as any;

    const transportRequest = vi.fn(async () => ({ ok: true }));
    const normalizeApprovalResolve = vi.fn(() => []);
    service.transport = { request: transportRequest };
    service.normalizer = { onApprovalResolveRequest: normalizeApprovalResolve };

    await service.request("exec.approval.resolve", {
      id: "approval-1",
      decision: "allow-once",
      sessionKey: "session-1",
      command: "python3 -c \"print('ok')\"",
      traceId: "trace-1",
      runId: "run-1",
      toolCallId: "tool-1",
    });

    expect(transportRequest).toHaveBeenCalledWith("exec.approval.resolve", {
      id: "approval-1",
      decision: "allow-once",
    });
    expect(normalizeApprovalResolve).toHaveBeenCalledWith({
      approvalId: "approval-1",
      decision: "allow-once",
      sessionKey: "session-1",
      commandHint: "python3 -c \"print('ok')\"",
      traceId: "trace-1",
      runId: "run-1",
      toolCallId: "tool-1",
    });
  });
});

describe("ChatWebSocketService handleEvent — abort", () => {
  function createService() {
    const service = new ChatWebSocketService() as any;
    service.transport = { on: vi.fn(), isConnected: () => true };
    service.normalizer = { ingestGatewayEvent: vi.fn(() => []) };
    return service;
  }

  function abortEvent(message?: unknown) {
    return {
      event: "chat",
      payload: {
        runId: "run-1",
        sessionKey: "session-1",
        state: "aborted",
        ...(message !== undefined ? { message } : {}),
      },
    };
  }

  it("abort event emits final delta and end (not error)", () => {
    const service = createService();
    const events: any[] = [];
    service.on("stream", (e: any) => events.push(e));

    service.handleEvent(abortEvent({ content: [{ type: "text", text: "partial reply" }] }));

    expect(events).toEqual([
      {
        type: "delta",
        sessionId: "session-1",
        messageId: "run-1",
        content: "partial reply",
      },
      { type: "end", sessionId: "session-1", messageId: "run-1" },
    ]);
  });

  it("abort event without message emits end only", () => {
    const service = createService();
    const events: any[] = [];
    service.on("stream", (e: any) => events.push(e));

    service.handleEvent(abortEvent());

    expect(events).toEqual([{ type: "end", sessionId: "session-1", messageId: "run-1" }]);
  });

  it("abort event does not emit error type", () => {
    const service = createService();
    const events: any[] = [];
    service.on("stream", (e: any) => events.push(e));

    service.handleEvent(abortEvent({ content: [{ type: "text", text: "hello" }] }));

    expect(events.every((e) => e.type !== "error")).toBe(true);
  });
});
