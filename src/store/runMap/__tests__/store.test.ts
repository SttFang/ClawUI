import { beforeEach, describe, expect, it } from "vitest";
import { useRunMapStore } from "../index";

describe("runMap store", () => {
  beforeEach(() => {
    useRunMapStore.getState().resetAll();
  });

  it("tracks chatRunId + approvalId + toolCallId in one session map", () => {
    const sessionKey = "agent:main:ui:s1";

    useRunMapStore.getState().ingestNormalizedEvent({
      kind: "run.started",
      traceId: "trace-1",
      timestampMs: 1000,
      sessionKey,
      clientRunId: "R-A",
      status: "started",
      source: "synthetic",
      correlationConfidence: "exact",
    });

    useRunMapStore.getState().ingestGatewayFrame({
      type: "event",
      event: "exec.approval.requested",
      payload: {
        id: "AP-9",
        request: {
          sessionKey,
          command: "python3 demo.py",
        },
        createdAtMs: 1100,
      },
    });

    useRunMapStore.getState().ingestGatewayFrame({
      type: "event",
      event: "exec.approval.resolved",
      payload: {
        id: "AP-9",
        decision: "allow-once",
        ts: 1200,
      },
    });

    useRunMapStore.getState().ingestNormalizedEvent({
      kind: "run.tool_started",
      traceId: "trace-1",
      timestampMs: 1300,
      sessionKey,
      clientRunId: "R-A",
      agentRunId: "AG-1",
      status: "running",
      metadata: {
        name: "read",
        phase: "start",
        toolCallId: "TC-1",
      },
    });

    const session = useRunMapStore.getState().sessions[sessionKey];
    expect(session?.rootChatRunId).toBe("R-A");
    expect(session?.runsById["R-A"]?.status).toBe("running");
    expect(session?.approvalsById["AP-9"]?.relatedRunId).toBe("R-A");
    expect(session?.approvalsById["AP-9"]?.status).toBe("resolved");
    expect(session?.toolCallsById["TC-1"]?.runId).toBe("R-A");
    expect(session?.indexes.runIdByAgentRunId["AG-1"]).toBe("R-A");
  });

  it("creates fallback agent run when incoming runId cannot be correlated", () => {
    const sessionKey = "agent:main:ui:s2";

    useRunMapStore.getState().ingestGatewayFrame({
      type: "event",
      event: "agent",
      payload: {
        sessionKey,
        runId: "agent-fallback-1",
        stream: "lifecycle",
        ts: 2000,
        data: {
          phase: "start",
        },
      },
    });

    const session = useRunMapStore.getState().sessions[sessionKey];
    expect(session?.runsById["agent-fallback-1"]?.source).toBe("fallback");
    expect(session?.runsById["agent-fallback-1"]?.type).toBe("agent");
  });

  it("accepts tool_use_id from gateway tool stream", () => {
    const sessionKey = "agent:main:ui:s3";

    useRunMapStore.getState().ingestGatewayFrame({
      type: "event",
      event: "agent",
      payload: {
        sessionKey,
        runId: "agent-run-tool-use",
        stream: "tool",
        ts: 2100,
        data: {
          phase: "start",
          name: "read",
          tool_use_id: "TC-USE-1",
        },
      },
    });

    const session = useRunMapStore.getState().sessions[sessionKey];
    expect(session?.toolCallsById["TC-USE-1"]?.toolName).toBe("read");
    expect(session?.toolCallsById["TC-USE-1"]?.phase).toBe("start");
  });
});
