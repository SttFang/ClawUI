import { describe, expect, it, vi } from "vitest";
import { ChatWebSocketService } from "../../chat-websocket";

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
