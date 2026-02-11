import type { ChatNormalizedRunEvent, ChatRunStatus } from "@clawui/types";
import type { GatewayEventFrame } from "./chat-websocket";

const PENDING_APPROVAL_TTL_MS = 30_000;
const TERMINAL_RUN_TTL_MS = 10 * 60_000;
const GC_INTERVAL_MS = 30_000;

type RunState = {
  traceId: string;
  sessionKey: string;
  clientRunId: string;
  agentRunId?: string;
  status: ChatRunStatus;
  startedAtMs: number;
  lastEventAtMs: number;
};

type PendingApproval = {
  id: string;
  sessionKey: string;
  command?: string;
  traceId?: string;
  createdAtMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTerminal(status: ChatRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "aborted";
}

function normalizeStatus(current: ChatRunStatus, next: ChatRunStatus): ChatRunStatus {
  if (isTerminal(current)) return current;
  return next;
}

function extractTextFromMessage(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  const content = message.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    if (!isRecord(item)) continue;
    const text = item.text;
    if (typeof text === "string" && text.trim()) return text;
  }
  return undefined;
}

export class ChatEventNormalizer {
  private traceSeq = 0;
  private runsByTrace = new Map<string, RunState>();
  private traceBySessionClient = new Map<string, string>();
  private traceBySessionAgent = new Map<string, string>();
  private latestTraceBySession = new Map<string, string>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private lastGcAtMs = 0;

  private nextTraceId(): string {
    this.traceSeq += 1;
    return `trace-${Date.now()}-${this.traceSeq}`;
  }

  private clientKey(sessionKey: string, runId: string): string {
    return `${sessionKey}::client::${runId}`;
  }

  private agentKey(sessionKey: string, runId: string): string {
    return `${sessionKey}::agent::${runId}`;
  }

  private getLatestActiveRun(sessionKey: string): RunState | null {
    const traceId = this.latestTraceBySession.get(sessionKey);
    if (!traceId) return null;
    const run = this.runsByTrace.get(traceId);
    if (!run || isTerminal(run.status)) return null;
    return run;
  }

  private linkAgentAlias(run: RunState, sessionKey: string, runId: string): void {
    if (!run.agentRunId) run.agentRunId = runId;
    this.traceBySessionAgent.set(this.agentKey(sessionKey, runId), run.traceId);
  }

  private findRunFromRecentApproval(sessionKey: string): RunState | null {
    const now = Date.now();
    let selected: RunState | null = null;
    for (const approval of this.pendingApprovals.values()) {
      if (approval.sessionKey !== sessionKey) continue;
      if (now - approval.createdAtMs > PENDING_APPROVAL_TTL_MS) continue;
      if (!approval.traceId) continue;
      const run = this.runsByTrace.get(approval.traceId);
      if (!run || isTerminal(run.status)) continue;
      if (!selected || run.lastEventAtMs > selected.lastEventAtMs) {
        selected = run;
      }
    }
    return selected;
  }

  private hasRecentApprovalContext(sessionKey: string): boolean {
    const now = Date.now();
    for (const approval of this.pendingApprovals.values()) {
      if (approval.sessionKey !== sessionKey) continue;
      if (now - approval.createdAtMs <= PENDING_APPROVAL_TTL_MS) return true;
    }
    return false;
  }

  private removeRun(traceId: string, run: RunState): void {
    this.runsByTrace.delete(traceId);
    this.traceBySessionClient.delete(this.clientKey(run.sessionKey, run.clientRunId));
    if (run.agentRunId) {
      this.traceBySessionAgent.delete(this.agentKey(run.sessionKey, run.agentRunId));
    }
    if (this.latestTraceBySession.get(run.sessionKey) === traceId) {
      this.latestTraceBySession.delete(run.sessionKey);
    }
  }

  private gc(now = Date.now()): void {
    if (now - this.lastGcAtMs < GC_INTERVAL_MS) return;
    this.lastGcAtMs = now;

    for (const [id, approval] of this.pendingApprovals) {
      if (now - approval.createdAtMs > PENDING_APPROVAL_TTL_MS) {
        this.pendingApprovals.delete(id);
      }
    }

    for (const [traceId, run] of this.runsByTrace) {
      if (!isTerminal(run.status)) continue;
      if (now - run.lastEventAtMs <= TERMINAL_RUN_TTL_MS) continue;
      this.removeRun(traceId, run);
    }
  }

  private ensureRun(params: {
    sessionKey: string;
    clientRunId: string;
    startedAtMs?: number;
  }): RunState {
    const { sessionKey, clientRunId } = params;
    const key = this.clientKey(sessionKey, clientRunId);
    const existingTrace = this.traceBySessionClient.get(key);
    if (existingTrace) {
      const run = this.runsByTrace.get(existingTrace);
      if (run) return run;
    }

    const now = params.startedAtMs ?? Date.now();
    const traceId = this.nextTraceId();
    const run: RunState = {
      traceId,
      sessionKey,
      clientRunId,
      status: "started",
      startedAtMs: now,
      lastEventAtMs: now,
    };
    this.runsByTrace.set(traceId, run);
    this.traceBySessionClient.set(key, traceId);
    this.latestTraceBySession.set(sessionKey, traceId);
    return run;
  }

  private maybeBindAliasFromSession(params: {
    sessionKey: string;
    runId: string;
    aliasKind: "client" | "agent";
  }): RunState | null {
    const run = this.getLatestActiveRun(params.sessionKey);
    if (!run) return null;

    if (params.aliasKind === "client") {
      this.traceBySessionClient.set(this.clientKey(params.sessionKey, params.runId), run.traceId);
    } else {
      if (!run.agentRunId) run.agentRunId = params.runId;
      this.traceBySessionAgent.set(this.agentKey(params.sessionKey, params.runId), run.traceId);
    }
    run.lastEventAtMs = Date.now();
    return run;
  }

  private resolveRunByClient(sessionKey: string, runId: string): RunState | null {
    const traceId = this.traceBySessionClient.get(this.clientKey(sessionKey, runId));
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
  }

  private resolveRunByAgent(sessionKey: string, runId: string): RunState | null {
    const traceId = this.traceBySessionAgent.get(this.agentKey(sessionKey, runId));
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
  }

  private eventBase(
    run: RunState,
    options?: { source?: "gateway" | "synthetic"; correlationConfidence?: "exact" | "fallback" },
  ): Omit<ChatNormalizedRunEvent, "kind"> {
    return {
      traceId: run.traceId,
      timestampMs: Date.now(),
      sessionKey: run.sessionKey,
      clientRunId: run.clientRunId,
      agentRunId: run.agentRunId,
      status: run.status,
      source: options?.source ?? "gateway",
      correlationConfidence: options?.correlationConfidence ?? "exact",
    };
  }

  onChatSendAccepted(params: {
    sessionKey: string;
    clientRunId: string;
  }): ChatNormalizedRunEvent[] {
    const run = this.ensureRun({
      sessionKey: params.sessionKey,
      clientRunId: params.clientRunId,
      startedAtMs: Date.now(),
    });
    run.status = "started";
    run.lastEventAtMs = Date.now();
    return [
      {
        kind: "run.started",
        ...this.eventBase(run, { source: "synthetic" }),
        metadata: {},
      },
    ];
  }

  resetSession(sessionKey: string): void {
    for (const [traceId, run] of this.runsByTrace) {
      if (run.sessionKey !== sessionKey) continue;
      this.removeRun(traceId, run);
    }

    for (const [approvalId, approval] of this.pendingApprovals) {
      if (approval.sessionKey === sessionKey) {
        this.pendingApprovals.delete(approvalId);
      }
    }
  }

  resetAll(): void {
    this.traceSeq = 0;
    this.runsByTrace.clear();
    this.traceBySessionClient.clear();
    this.traceBySessionAgent.clear();
    this.latestTraceBySession.clear();
    this.pendingApprovals.clear();
    this.lastGcAtMs = 0;
  }

  onApprovalResolveRequest(params: {
    approvalId?: string;
    decision?: "allow-once" | "allow-always" | "deny";
  }): ChatNormalizedRunEvent[] {
    if (!params.approvalId) return [];
    const approval = this.pendingApprovals.get(params.approvalId);
    if (!approval) return [];
    this.pendingApprovals.delete(params.approvalId);
    const run =
      (approval.traceId ? this.runsByTrace.get(approval.traceId) : null) ??
      this.getLatestActiveRun(approval.sessionKey);
    if (!run) return [];

    if (params.decision === "deny") {
      run.status = normalizeStatus(run.status, "aborted");
    } else {
      run.status = normalizeStatus(run.status, "running");
    }
    run.lastEventAtMs = Date.now();
    return [
      {
        kind: "run.approval_resolved",
        ...this.eventBase(run),
        approvalId: params.approvalId,
        decision: params.decision,
        command: approval.command,
      },
    ];
  }

  ingestGatewayEvent(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!frame || frame.type !== "event") return [];
    this.gc();

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

    let correlationConfidence: "exact" | "fallback" = "exact";
    let run = this.resolveRunByClient(sessionKey, runId);
    if (!run) {
      run = this.resolveRunByAgent(sessionKey, runId);
    }
    if (!run) {
      correlationConfidence = "fallback";
      run = this.maybeBindAliasFromSession({
        sessionKey,
        runId,
        aliasKind: "client",
      });
    }
    if (!run) {
      correlationConfidence = "fallback";
      run = this.ensureRun({ sessionKey, clientRunId: runId });
    }

    run.lastEventAtMs = Date.now();
    const events: ChatNormalizedRunEvent[] = [];

    if (state === "delta") {
      run.status = normalizeStatus(run.status, "running");
      events.push({
        kind: "run.delta",
        ...this.eventBase(run, { correlationConfidence }),
        text: extractTextFromMessage(payload.message),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "final") {
      run.status = normalizeStatus(run.status, "completed");
      events.push({
        kind: "run.completed",
        ...this.eventBase(run, { correlationConfidence }),
        text: extractTextFromMessage(payload.message),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "aborted") {
      run.status = normalizeStatus(run.status, "aborted");
      events.push({
        kind: "run.aborted",
        ...this.eventBase(run, { correlationConfidence }),
        rawEventName: "chat",
        rawSeq: typeof payload.seq === "number" ? payload.seq : undefined,
      });
      return events;
    }

    if (state === "error") {
      run.status = normalizeStatus(run.status, "failed");
      const errorText =
        typeof payload.errorMessage === "string" ? payload.errorMessage : "chat error";
      events.push({
        kind: "run.failed",
        ...this.eventBase(run, { correlationConfidence }),
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

    let correlationConfidence: "exact" | "fallback" = "exact";
    let run = this.resolveRunByAgent(sessionKey, runId);
    if (!run) {
      correlationConfidence = "fallback";
      run = this.maybeBindAliasFromSession({
        sessionKey,
        runId,
        aliasKind: "agent",
      });
    }
    if (!run) {
      correlationConfidence = "fallback";
      run = this.findRunFromRecentApproval(sessionKey);
      if (run) {
        this.linkAgentAlias(run, sessionKey, runId);
      }
    }
    if (!run && this.hasRecentApprovalContext(sessionKey)) {
      correlationConfidence = "fallback";
      run = this.ensureRun({ sessionKey, clientRunId: runId });
      this.linkAgentAlias(run, sessionKey, runId);
    }
    if (!run) return [];

    run.lastEventAtMs = Date.now();
    if (!run.agentRunId) run.agentRunId = runId;
    const seq = typeof payload.seq === "number" ? payload.seq : undefined;
    const data = isRecord(payload.data) ? payload.data : {};

    if (stream === "tool") {
      const phase = typeof data.phase === "string" ? data.phase : "";
      if (phase === "start") {
        run.status = normalizeStatus(run.status, "running");
        return [
          {
            kind: "run.tool_started",
            ...this.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: data,
          },
        ];
      }
      if (phase === "update") {
        run.status = normalizeStatus(run.status, "running");
        return [
          {
            kind: "run.tool_updated",
            ...this.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: data,
          },
        ];
      }
      if (phase === "result" || phase === "error" || phase === "end") {
        if (data.isError === true || phase === "error") {
          run.status = normalizeStatus(run.status, "failed");
        } else {
          run.status = normalizeStatus(run.status, "running");
        }
        return [
          {
            kind: "run.tool_finished",
            ...this.eventBase(run, { correlationConfidence }),
            rawEventName: "agent.tool",
            rawSeq: seq,
            metadata: data,
          },
        ];
      }
      return [];
    }

    if (stream === "lifecycle") {
      const phase = typeof data.phase === "string" ? data.phase : "";
      if (phase === "error") {
        run.status = normalizeStatus(run.status, "failed");
      } else if (phase === "end") {
        // lifecycle=end can happen before chat.final; keep run running and let chat.final win.
        run.status = normalizeStatus(run.status, "running");
      } else {
        run.status = normalizeStatus(run.status, "running");
      }
      return [
        {
          kind: "run.lifecycle",
          ...this.eventBase(run, { correlationConfidence }),
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
          ...this.eventBase(run, { correlationConfidence }),
          text: typeof data.text === "string" ? data.text : undefined,
          rawEventName: "agent.assistant",
          rawSeq: seq,
        },
      ];
    }

    return [];
  }

  private ingestExecApprovalRequested(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const id = typeof frame.payload.id === "string" ? frame.payload.id : "";
    const request = isRecord(frame.payload.request) ? frame.payload.request : null;
    const sessionKey = request && typeof request.sessionKey === "string" ? request.sessionKey : "";
    const command = request && typeof request.command === "string" ? request.command : undefined;
    if (!id || !sessionKey) return [];

    const run = this.getLatestActiveRun(sessionKey);
    const traceId = run?.traceId;
    this.pendingApprovals.set(id, {
      id,
      sessionKey,
      command,
      traceId,
      createdAtMs: Date.now(),
    });
    if (!run) return [];

    run.status = normalizeStatus(run.status, "waiting_approval");
    run.lastEventAtMs = Date.now();
    return [
      {
        kind: "run.waiting_approval",
        ...this.eventBase(run),
        approvalId: id,
        command,
      },
    ];
  }

  private ingestExecApprovalResolved(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    if (!isRecord(frame.payload)) return [];
    const id = typeof frame.payload.id === "string" ? frame.payload.id : "";
    if (!id) return [];
    const decisionRaw = frame.payload.decision;
    const decision =
      decisionRaw === "allow-once" || decisionRaw === "allow-always" || decisionRaw === "deny"
        ? decisionRaw
        : undefined;
    return this.onApprovalResolveRequest({ approvalId: id, decision });
  }
}
