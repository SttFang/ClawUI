import type { ChatNormalizedRunEvent, ChatRunStatus } from "@clawui/types";

const PENDING_APPROVAL_TTL_MS = 30_000;
const TERMINAL_RUN_TTL_MS = 10 * 60_000;
const GC_INTERVAL_MS = 30_000;

export type RunState = {
  traceId: string;
  sessionKey: string;
  clientRunId: string;
  agentRunId?: string;
  status: ChatRunStatus;
  startedAtMs: number;
  lastEventAtMs: number;
};

export type PendingApproval = {
  id: string;
  sessionKey: string;
  command?: string;
  traceId?: string;
  createdAtMs: number;
};

export function isTerminalStatus(status: ChatRunStatus): boolean {
  return status === "completed" || status === "failed" || status === "aborted";
}

export function normalizeRunStatus(current: ChatRunStatus, next: ChatRunStatus): ChatRunStatus {
  if (isTerminalStatus(current)) return current;
  return next;
}

export class ChatRunState {
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

  gc(now = Date.now()): void {
    if (now - this.lastGcAtMs < GC_INTERVAL_MS) return;
    this.lastGcAtMs = now;

    for (const [id, approval] of this.pendingApprovals) {
      if (now - approval.createdAtMs > PENDING_APPROVAL_TTL_MS) {
        this.pendingApprovals.delete(id);
      }
    }

    for (const [traceId, run] of this.runsByTrace) {
      if (!isTerminalStatus(run.status)) continue;
      if (now - run.lastEventAtMs <= TERMINAL_RUN_TTL_MS) continue;
      this.removeRun(traceId, run);
    }
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

  touchRun(run: RunState): void {
    run.lastEventAtMs = Date.now();
  }

  getLatestActiveRun(sessionKey: string): RunState | null {
    const traceId = this.latestTraceBySession.get(sessionKey);
    if (!traceId) return null;
    const run = this.runsByTrace.get(traceId);
    if (!run || isTerminalStatus(run.status)) return null;
    return run;
  }

  ensureRun(params: { sessionKey: string; clientRunId: string; startedAtMs?: number }): RunState {
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

  resolveRunByClient(sessionKey: string, runId: string): RunState | null {
    const traceId = this.traceBySessionClient.get(this.clientKey(sessionKey, runId));
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
  }

  resolveRunByAgent(sessionKey: string, runId: string): RunState | null {
    const traceId = this.traceBySessionAgent.get(this.agentKey(sessionKey, runId));
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
  }

  maybeBindAliasFromSession(params: {
    sessionKey: string;
    runId: string;
    aliasKind: "client" | "agent";
  }): RunState | null {
    const run = this.getLatestActiveRun(params.sessionKey);
    if (!run) return null;

    if (params.aliasKind === "client") {
      this.traceBySessionClient.set(this.clientKey(params.sessionKey, params.runId), run.traceId);
    } else {
      this.linkAgentAlias(run, params.sessionKey, params.runId);
    }
    this.touchRun(run);
    return run;
  }

  linkAgentAlias(run: RunState, sessionKey: string, runId: string): void {
    if (!run.agentRunId) run.agentRunId = runId;
    this.traceBySessionAgent.set(this.agentKey(sessionKey, runId), run.traceId);
  }

  findRunFromRecentApproval(sessionKey: string): RunState | null {
    const now = Date.now();
    let selected: RunState | null = null;
    for (const approval of this.pendingApprovals.values()) {
      if (approval.sessionKey !== sessionKey) continue;
      if (now - approval.createdAtMs > PENDING_APPROVAL_TTL_MS) continue;
      if (!approval.traceId) continue;
      const run = this.runsByTrace.get(approval.traceId);
      if (!run || isTerminalStatus(run.status)) continue;
      if (!selected || run.lastEventAtMs > selected.lastEventAtMs) {
        selected = run;
      }
    }
    return selected;
  }

  hasRecentApprovalContext(sessionKey: string): boolean {
    const now = Date.now();
    for (const approval of this.pendingApprovals.values()) {
      if (approval.sessionKey !== sessionKey) continue;
      if (now - approval.createdAtMs <= PENDING_APPROVAL_TTL_MS) return true;
    }
    return false;
  }

  recordApprovalRequest(params: {
    id: string;
    sessionKey: string;
    command?: string;
  }): RunState | null {
    const run = this.getLatestActiveRun(params.sessionKey);
    const traceId = run?.traceId;
    this.pendingApprovals.set(params.id, {
      id: params.id,
      sessionKey: params.sessionKey,
      command: params.command,
      traceId,
      createdAtMs: Date.now(),
    });
    return run;
  }

  consumeApproval(params: {
    id: string;
  }): { approval: PendingApproval; run: RunState | null } | null {
    const approval = this.pendingApprovals.get(params.id);
    if (!approval) return null;
    this.pendingApprovals.delete(params.id);

    const run =
      (approval.traceId ? this.runsByTrace.get(approval.traceId) : null) ??
      this.getLatestActiveRun(approval.sessionKey);

    return { approval, run: run ?? null };
  }

  eventBase(
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
}
