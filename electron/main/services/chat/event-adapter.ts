import type { ChatNormalizedRunEvent } from "@clawui/types";
import type { GatewayEventFrame } from "../chat-websocket";
import { chatLog } from "../../lib/logger";
import { isRecord } from "../../utils/type-guards";
import { extractTextFromMessage, normalizeToolMetadata } from "./event-parsers";
import { ChatRunState, normalizeRunStatus } from "./run-state";

export class ChatEventAdapter {
  constructor(private readonly state = new ChatRunState()) {}

  resetSession(sessionKey: string): void {
    this.state.resetSession(sessionKey);
  }

  resetAll(): void {
    this.state.resetAll();
  }

  onChatSendAccepted(params: {
    sessionKey: string;
    clientRunId: string;
  }): ChatNormalizedRunEvent[] {
    const run = this.state.ensureRun({
      sessionKey: params.sessionKey,
      clientRunId: params.clientRunId,
      startedAtMs: Date.now(),
    });
    run.status = "started";
    this.state.touchRun(run);
    return [
      {
        kind: "run.started",
        ...this.state.eventBase(run, { source: "synthetic" }),
        metadata: {},
      },
    ];
  }

  onApprovalResolveRequest(params: {
    approvalId?: string;
    decision?: "allow-once" | "allow-always" | "deny";
    sessionKey?: string;
    commandHint?: string;
    traceId?: string;
    runId?: string;
    toolCallId?: string;
  }): ChatNormalizedRunEvent[] {
    const approvalId = params.approvalId?.trim();
    if (!approvalId) return [];
    const sessionKey = params.sessionKey?.trim() || undefined;
    const traceId = params.traceId?.trim() || undefined;

    const consumed = this.state.consumeApproval({
      id: approvalId,
      sessionKey,
      traceId,
    });

    if (!consumed.consumed && consumed.reason === "not_found") {
      const recoveredRun =
        this.state.resolveRunByTrace(traceId) ??
        (sessionKey ? this.state.getLatestRun(sessionKey) : null);
      if (!recoveredRun) {
        chatLog.debug(
          "[chat.approval.resolve.skip_not_found]",
          `approvalId=${approvalId}`,
          `sessionKey=${sessionKey ?? "<unknown>"}`,
          `traceId=${traceId ?? "<none>"}`,
        );
        return [];
      }
      const commandHint = params.commandHint?.trim();
      if (params.decision === "deny") {
        recoveredRun.status = normalizeRunStatus(recoveredRun.status, "aborted");
      } else {
        recoveredRun.status = normalizeRunStatus(recoveredRun.status, "running");
      }
      this.state.touchRun(recoveredRun);
      return [
        {
          kind: "run.approval_resolved",
          ...this.state.eventBase(recoveredRun, { correlationConfidence: "fallback" }),
          approvalId,
          decision: params.decision,
          command: commandHint || undefined,
          correlationConfidence: "fallback",
        },
      ];
    }

    const fallbackSession = consumed.consumed
      ? undefined
      : (sessionKey ?? consumed.approval?.sessionKey ?? undefined);

    const run = consumed.consumed
      ? consumed.run
      : (this.state.findRunFromRecentApproval(fallbackSession) ??
        (fallbackSession ? this.state.getLatestRun(fallbackSession) : null));
    if (!run) {
      chatLog.warn(
        "[chat.approval.resolve.no_run]",
        `approvalId=${approvalId}`,
        `sessionKey=${sessionKey ?? "<unknown>"}`,
        `reason=${consumed.reason}`,
        `traceId=${traceId ?? "<none>"}`,
      );
      return [];
    }

    const command = consumed.consumed ? consumed.approval.command : params.commandHint;
    if (params.decision === "deny") {
      run.status = normalizeRunStatus(run.status, "aborted");
    } else {
      run.status = normalizeRunStatus(run.status, "running");
    }
    this.state.touchRun(run);

    return [
      {
        kind: "run.approval_resolved",
        ...this.state.eventBase(run),
        approvalId,
        decision: params.decision,
        command,
        correlationConfidence:
          consumed.consumed && consumed.reason === "matched" ? "exact" : "fallback",
      },
    ];
  }

  ingestGatewayEvent(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!frame || frame.type !== "event") return [];
    this.state.gc();

    if (frame.event === "chat") {
      return this.ingestChatEvent(frame);
    }
    if (frame.event === "agent") {
      return this.ingestAgentEvent(frame);
    }
    if (frame.event === "exec.approval.requested") {
      return this.ingestExecApprovalRequested(frame);
    }
    if (frame.event === "exec.approval.resolved") {
      return this.ingestExecApprovalResolved(frame);
    }
    return [];
  }

  private ingestChatEvent(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const payload = frame.payload;
    const runId = typeof payload.runId === "string" ? payload.runId : "";
    const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
    const state = typeof payload.state === "string" ? payload.state : "";
    if (!runId || !sessionKey || !state) return [];

    const { run, correlationConfidence } = this.state.resolveOrCreateRun({
      sessionKey,
      runId,
      source: "chat",
    });

    this.state.touchRun(run);
    const events: ChatNormalizedRunEvent[] = [];

    if (state === "delta") {
      run.status = normalizeRunStatus(run.status, "running");
      events.push({
        kind: "run.delta",
        ...this.state.eventBase(run, { correlationConfidence }),
        text: extractTextFromMessage(payload.message),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "final") {
      run.status = normalizeRunStatus(run.status, "completed");
      events.push({
        kind: "run.completed",
        ...this.state.eventBase(run, { correlationConfidence }),
        text: extractTextFromMessage(payload.message),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "aborted") {
      run.status = normalizeRunStatus(run.status, "aborted");
      events.push({
        kind: "run.aborted",
        ...this.state.eventBase(run, { correlationConfidence }),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "error") {
      run.status = normalizeRunStatus(run.status, "failed");
      const errorText =
        typeof payload.errorMessage === "string" ? payload.errorMessage : "chat error";
      events.push({
        kind: "run.failed",
        ...this.state.eventBase(run, { correlationConfidence }),
        error: errorText,
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
    }

    return events;
  }

  private ingestAgentEvent(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const payload = frame.payload;
    const runId = typeof payload.runId === "string" ? payload.runId : "";
    const stream = typeof payload.stream === "string" ? payload.stream : "";
    const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
    if (!runId || !stream || !sessionKey) return [];

    const { run, correlationConfidence } = this.state.resolveOrCreateRun({
      sessionKey,
      runId,
      source: "agent",
    });

    this.state.touchRun(run);
    if (!run.agentRunId) run.agentRunId = runId;
    const seq = typeof payload.seq === "number" ? payload.seq : undefined;
    const data = isRecord(payload.data) ? payload.data : {};
    const normalizedToolData = stream === "tool" ? normalizeToolMetadata(data) : data;

    if (stream === "tool") {
      const phase = typeof normalizedToolData.phase === "string" ? normalizedToolData.phase : "";
      if (phase === "start") {
        run.status = normalizeRunStatus(run.status, "running");
        return [
          {
            kind: "run.tool_started",
            ...this.state.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: normalizedToolData,
          },
        ];
      }
      if (phase === "update") {
        run.status = normalizeRunStatus(run.status, "running");
        return [
          {
            kind: "run.tool_updated",
            ...this.state.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: normalizedToolData,
          },
        ];
      }
      if (phase === "result" || phase === "error" || phase === "end") {
        if (normalizedToolData.isError === true || phase === "error") {
          run.status = normalizeRunStatus(run.status, "failed");
        } else {
          run.status = normalizeRunStatus(run.status, "running");
        }
        return [
          {
            kind: "run.tool_finished",
            ...this.state.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: normalizedToolData,
          },
        ];
      }
      return [];
    }

    if (stream === "lifecycle") {
      const phase = typeof data.phase === "string" ? data.phase : "";
      if (phase === "end") {
        run.status = normalizeRunStatus(run.status, "completed");
      } else if (phase === "error") {
        run.status = normalizeRunStatus(run.status, "failed");
      } else {
        run.status = normalizeRunStatus(run.status, "running");
      }
      return [
        {
          kind: "run.lifecycle",
          ...this.state.eventBase(run, { correlationConfidence }),
          rawEventName: "agent.lifecycle",
          rawSeq: seq,
          metadata: data,
        },
      ];
    }

    if (stream === "assistant") {
      return [
        {
          kind: "run.delta",
          ...this.state.eventBase(run, { correlationConfidence }),
          text: typeof data.text === "string" ? data.text : undefined,
          rawEventName: "agent.assistant",
          rawSeq: seq,
        },
      ];
    }

    if (stream === "compaction") {
      const phase = typeof data.phase === "string" ? data.phase : "";
      return [
        {
          kind: "run.lifecycle",
          ...this.state.eventBase(run, { correlationConfidence }),
          rawEventName: "agent.compaction",
          rawSeq: seq,
          metadata: { stream: "compaction", phase, willRetry: data.willRetry },
        },
      ];
    }

    return [];
  }

  private ingestExecApprovalRequested(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const id =
      typeof frame.payload.id === "string"
        ? frame.payload.id
        : isRecord(frame.payload.request) && typeof frame.payload.request.id === "string"
          ? frame.payload.request.id
          : "";
    const request = isRecord(frame.payload.request) ? frame.payload.request : null;
    const sessionKey = request && typeof request.sessionKey === "string" ? request.sessionKey : "";
    const command = isRecord(frame.payload.request)
      ? typeof request?.command === "string"
        ? request?.command
        : typeof frame.payload.command === "string"
          ? frame.payload.command
          : ""
      : "";
    const requestId =
      request && typeof request.id === "string"
        ? request.id
        : typeof frame.payload.requestId === "string"
          ? frame.payload.requestId
          : undefined;
    if (!id) return [];

    const run = this.state.recordApprovalRequest({
      id,
      sessionKey,
      command: command || undefined,
      requestId,
    });
    if (!run) return [];

    run.status = normalizeRunStatus(run.status, "waiting_approval");
    this.state.touchRun(run);
    return [
      {
        kind: "run.waiting_approval",
        ...this.state.eventBase(run),
        approvalId: id,
        command,
      },
    ];
  }

  private ingestExecApprovalResolved(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const id =
      typeof frame.payload.id === "string"
        ? frame.payload.id
        : isRecord(frame.payload.request) && typeof frame.payload.request.id === "string"
          ? frame.payload.request.id
          : "";
    if (!id) return [];
    const decisionRaw = frame.payload.decision;
    const decision =
      decisionRaw === "allow-once" || decisionRaw === "allow-always" || decisionRaw === "deny"
        ? decisionRaw
        : undefined;
    const request = isRecord(frame.payload.request) ? frame.payload.request : null;
    const sessionKey =
      request && typeof request.sessionKey === "string"
        ? request.sessionKey
        : typeof frame.payload.sessionKey === "string"
          ? frame.payload.sessionKey
          : "";
    const command =
      request && typeof request.command === "string"
        ? request.command
        : typeof frame.payload.command === "string"
          ? frame.payload.command
          : undefined;
    const traceId =
      request && typeof request.traceId === "string"
        ? request.traceId
        : typeof frame.payload.traceId === "string"
          ? frame.payload.traceId
          : undefined;
    return this.onApprovalResolveRequest({
      approvalId: id,
      decision,
      sessionKey,
      commandHint: command,
      traceId,
    });
  }
}
