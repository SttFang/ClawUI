import type { ChatNormalizedRunEvent } from "@clawui/types";
import { isTerminalStatus, type ConsumeApprovalResult, type RunState } from "./run-types";
import { ApprovalState, type RunStateAccess } from "./approval-state";

export {
  DEFAULT_PENDING_APPROVAL_TTL_MS,
  MAX_PENDING_APPROVAL_COUNT,
  isTerminalStatus,
  normalizeRunStatus,
} from "./run-types";
export type { ConsumeApprovalResult, PendingApproval, RunState } from "./run-types";

const TERMINAL_RUN_TTL_MS = 10 * 60_000;
const GC_INTERVAL_MS = 30_000;

export class ChatRunState implements RunStateAccess {
  private traceSeq = 0;
  private runsByTrace = new Map<string, RunState>();
  private traceBySessionClient = new Map<string, string>();
  private traceBySessionAgent = new Map<string, string>();
  private latestTraceBySession = new Map<string, string>();
  private lastGcAtMs = 0;

  readonly approvals: ApprovalState;

  constructor() {
    this.approvals = new ApprovalState(this);
  }

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

  getMostRecentActiveRun(): RunState | null {
    let selected: RunState | null = null;
    for (const run of this.runsByTrace.values()) {
      if (isTerminalStatus(run.status)) continue;
      if (!selected || run.lastEventAtMs > selected.lastEventAtMs) {
        selected = run;
      }
    }
    return selected;
  }

  gc(now = Date.now()): void {
    if (now - this.lastGcAtMs < GC_INTERVAL_MS) return;
    this.lastGcAtMs = now;

    this.approvals.gcApprovals(now);

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
    this.approvals.resetSession(sessionKey);
  }

  resetAll(): void {
    this.traceSeq = 0;
    this.runsByTrace.clear();
    this.traceBySessionClient.clear();
    this.traceBySessionAgent.clear();
    this.latestTraceBySession.clear();
    this.approvals.resetAll();
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

  getLatestRun(sessionKey: string): RunState | null {
    const traceId = this.latestTraceBySession.get(sessionKey);
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
  }

  resolveRunByTrace(traceId?: string): RunState | null {
    if (!traceId) return null;
    return this.runsByTrace.get(traceId) ?? null;
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

  // -- Approval delegates (preserve public API) --

  findRunFromRecentApproval(sessionKey?: string): RunState | null {
    return this.approvals.findRunFromRecentApproval(sessionKey);
  }

  hasRecentApprovalContext(sessionKey?: string): boolean {
    return this.approvals.hasRecentApprovalContext(sessionKey);
  }

  recordApprovalRequest(params: {
    id: string;
    sessionKey?: string;
    command?: string;
    requestId?: string;
  }): RunState | null {
    return this.approvals.recordApprovalRequest(params);
  }

  consumeApproval(params: {
    id: string;
    sessionKey?: string;
    traceId?: string;
  }): ConsumeApprovalResult {
    return this.approvals.consumeApproval(params);
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

  resolveOrCreateRun(params: { sessionKey: string; runId: string; source: "chat" | "agent" }): {
    run: RunState;
    correlationConfidence: "exact" | "fallback";
  } {
    const { sessionKey, runId, source } = params;

    if (source === "chat") {
      const byClient = this.resolveRunByClient(sessionKey, runId);
      if (byClient) return { run: byClient, correlationConfidence: "exact" };
      const byAgent = this.resolveRunByAgent(sessionKey, runId);
      if (byAgent) return { run: byAgent, correlationConfidence: "exact" };
      const bound = this.maybeBindAliasFromSession({ sessionKey, runId, aliasKind: "client" });
      if (bound) return { run: bound, correlationConfidence: "fallback" };
      return {
        run: this.ensureRun({ sessionKey, clientRunId: runId }),
        correlationConfidence: "fallback",
      };
    }

    // source === "agent"
    const byAgent = this.resolveRunByAgent(sessionKey, runId);
    if (byAgent) return { run: byAgent, correlationConfidence: "exact" };
    const bound = this.maybeBindAliasFromSession({ sessionKey, runId, aliasKind: "agent" });
    if (bound) return { run: bound, correlationConfidence: "fallback" };
    const fromApproval = this.findRunFromRecentApproval(sessionKey);
    if (fromApproval) {
      this.linkAgentAlias(fromApproval, sessionKey, runId);
      return { run: fromApproval, correlationConfidence: "fallback" };
    }
    const created = this.ensureRun({ sessionKey, clientRunId: runId });
    this.linkAgentAlias(created, sessionKey, runId);
    return { run: created, correlationConfidence: "fallback" };
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
