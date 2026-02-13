import type { ChatNormalizedRunEvent, ChatRunStatus } from "@clawui/types";
import { chatLog } from "../../lib/logger";

export const DEFAULT_PENDING_APPROVAL_TTL_MS = 120_000;
export const MAX_PENDING_APPROVAL_COUNT = 128;
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
  sessionKey?: string;
  command?: string;
  requestId?: string;
  traceId?: string;
  wasSessionBound?: boolean;
  createdAtMs: number;
};

export type ConsumeApprovalResult =
  | {
      consumed: true;
      reason: "matched" | "fallback";
      approval: PendingApproval;
      run: RunState;
    }
  | {
      consumed: false;
      reason: "not_found" | "session_not_found" | "run_not_found";
      approval: PendingApproval | null;
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

  private isPendingApprovalFresh(approval: PendingApproval, now = Date.now()): boolean {
    return now - approval.createdAtMs <= DEFAULT_PENDING_APPROVAL_TTL_MS;
  }

  private removeExpiredPendingApprovals(now = Date.now()): void {
    for (const [id, approval] of this.pendingApprovals) {
      if (!this.isPendingApprovalFresh(approval, now)) {
        this.pendingApprovals.delete(id);
      }
    }
  }

  private enforcePendingApprovalCapacity(): void {
    if (this.pendingApprovals.size <= MAX_PENDING_APPROVAL_COUNT) return;

    const orderedApprovals = [...this.pendingApprovals.entries()].sort(
      ([, a], [, b]) => a.createdAtMs - b.createdAtMs,
    );
    const overflow = orderedApprovals.length - MAX_PENDING_APPROVAL_COUNT;
    for (let i = 0; i < overflow; i++) {
      const [id] = orderedApprovals[i];
      this.pendingApprovals.delete(id);
    }
  }

  private getMostRecentActiveRun(): RunState | null {
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

    this.removeExpiredPendingApprovals(now);
    this.enforcePendingApprovalCapacity();

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

  findRunFromRecentApproval(sessionKey?: string): RunState | null {
    const now = Date.now();
    let selected: RunState | null = null;
    for (const approval of this.pendingApprovals.values()) {
      if (!this.isPendingApprovalFresh(approval, now)) continue;
      if (!approval.traceId) continue;
      if (sessionKey && approval.sessionKey !== sessionKey) continue;
      const run = this.runsByTrace.get(approval.traceId);
      if (!run || isTerminalStatus(run.status)) continue;
      if (!selected || run.lastEventAtMs > selected.lastEventAtMs) {
        selected = run;
      }
    }

    if (!selected && sessionKey) {
      return this.getLatestActiveRun(sessionKey) ?? this.getMostRecentActiveRun();
    }

    return selected ?? this.getMostRecentActiveRun();
  }

  hasRecentApprovalContext(sessionKey?: string): boolean {
    const now = Date.now();
    for (const approval of this.pendingApprovals.values()) {
      if (!this.isPendingApprovalFresh(approval, now)) continue;
      if (sessionKey && approval.sessionKey !== sessionKey) continue;
      return true;
    }
    return false;
  }

  recordApprovalRequest(params: {
    id: string;
    sessionKey?: string;
    command?: string;
    requestId?: string;
  }): RunState | null {
    const normalizedSessionKey = params.sessionKey?.trim();
    const fallbackRun = normalizedSessionKey
      ? (this.getLatestActiveRun(normalizedSessionKey) ??
        this.ensureRun({ sessionKey: normalizedSessionKey, clientRunId: params.id }))
      : this.getMostRecentActiveRun();

    const pending: PendingApproval = {
      id: params.id,
      sessionKey: fallbackRun?.sessionKey,
      requestId: params.requestId,
      command: params.command,
      traceId: fallbackRun?.traceId,
      wasSessionBound: Boolean(normalizedSessionKey && fallbackRun),
      createdAtMs: Date.now(),
    };

    this.pendingApprovals.set(params.id, pending);
    this.enforcePendingApprovalCapacity();

    chatLog.debug(
      "[chat.approval.record]",
      `approvalId=${params.id}`,
      `requestSessionKey=${normalizedSessionKey ?? "<missing>"}`,
      `boundSession=${pending.sessionKey ?? "<none>"}`,
      `runId=${pending.traceId ?? "<none>"}`,
      `requestId=${params.requestId ?? "<none>"}`,
      `wasSessionBound=${String(!!pending.wasSessionBound)}`,
    );

    return fallbackRun ?? null;
  }

  consumeApproval(params: {
    id: string;
    sessionKey?: string;
    traceId?: string;
  }): ConsumeApprovalResult {
    const approval = this.pendingApprovals.get(params.id);
    if (!approval) {
      return {
        consumed: false,
        reason: "not_found",
        approval: null,
      };
    }

    if (!this.isPendingApprovalFresh(approval)) {
      this.pendingApprovals.delete(params.id);
      return {
        consumed: false,
        reason: "run_not_found",
        approval,
      };
    }

    this.pendingApprovals.delete(params.id);

    const requestedSession = params.sessionKey?.trim();
    let run: RunState | null = null;
    let matchedByExactTrace = false;

    if (params.traceId || approval.traceId) {
      const runByTrace = this.getRunByTraceOrSession(
        params.traceId ?? approval.traceId,
        requestedSession,
      );
      if (runByTrace) {
        run = runByTrace;
        matchedByExactTrace = true;
      }
    }

    if (!run && approval.traceId) {
      const runByApprovalTrace = this.runsByTrace.get(approval.traceId);
      if (runByApprovalTrace && !isTerminalStatus(runByApprovalTrace.status)) {
        run = runByApprovalTrace;
        matchedByExactTrace = true;
      }
    }

    if (!run && requestedSession) {
      run = this.getLatestActiveRun(requestedSession);
    }

    if (!run && approval.sessionKey) {
      run = this.findRunFromRecentApproval(approval.sessionKey);
    }

    if (!run) {
      const fallbackSession = requestedSession ?? approval.sessionKey;
      const reason = fallbackSession ? "session_not_found" : "run_not_found";
      chatLog.warn(
        "[chat.approval.consume.miss]",
        `approvalId=${approval.id}`,
        `requestedSession=${fallbackSession ?? "<missing>"}`,
        `reason=${reason}`,
      );
      return {
        consumed: false,
        reason,
        approval,
      };
    }

    chatLog.debug(
      "[chat.approval.consume]",
      `approvalId=${approval.id}`,
      `session=${run.sessionKey}`,
      `run=${run.traceId}`,
      `matched=${String(matchedByExactTrace)}`,
      `fallback=${String(!matchedByExactTrace)}`,
      `requestId=${approval.requestId ?? "<none>"}`,
      `wasSessionBound=${String(!!approval.wasSessionBound)}`,
    );

    return {
      consumed: true,
      reason: matchedByExactTrace ? "matched" : "fallback",
      approval,
      run,
    };
  }

  private getRunByTraceOrSession(traceId?: string, sessionKey?: string): RunState | null {
    if (traceId) {
      const runByTrace = this.runsByTrace.get(traceId);
      if (runByTrace && !isTerminalStatus(runByTrace.status)) return runByTrace;
    }

    if (sessionKey) {
      const runBySession = this.getLatestActiveRun(sessionKey);
      if (runBySession) return runBySession;
    }

    return null;
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
