import { chatLog } from "../../lib/logger";
import {
  DEFAULT_PENDING_APPROVAL_TTL_MS,
  isTerminalStatus,
  MAX_PENDING_APPROVAL_COUNT,
  type ConsumeApprovalResult,
  type PendingApproval,
  type RunState,
} from "./run-types";

export interface RunStateAccess {
  getLatestActiveRun(sessionKey: string): RunState | null;
  getLatestRun(sessionKey: string): RunState | null;
  getMostRecentActiveRun(): RunState | null;
  ensureRun(params: { sessionKey: string; clientRunId: string }): RunState;
  resolveRunByTrace(traceId?: string): RunState | null;
}

export class ApprovalState {
  private pendingApprovals = new Map<string, PendingApproval>();

  constructor(private readonly runs: RunStateAccess) {}

  private isPendingApprovalFresh(approval: PendingApproval, now = Date.now()): boolean {
    return now - approval.createdAtMs <= DEFAULT_PENDING_APPROVAL_TTL_MS;
  }

  gcApprovals(now = Date.now()): void {
    for (const [id, approval] of this.pendingApprovals) {
      if (!this.isPendingApprovalFresh(approval, now)) {
        this.pendingApprovals.delete(id);
      }
    }
    this.enforcePendingApprovalCapacity();
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

  hasRecentApprovalContext(sessionKey?: string): boolean {
    const now = Date.now();
    for (const approval of this.pendingApprovals.values()) {
      if (!this.isPendingApprovalFresh(approval, now)) continue;
      if (sessionKey && approval.sessionKey !== sessionKey) continue;
      return true;
    }
    return false;
  }

  findRunFromRecentApproval(sessionKey?: string): RunState | null {
    const now = Date.now();
    let selected: RunState | null = null;
    for (const approval of this.pendingApprovals.values()) {
      if (!this.isPendingApprovalFresh(approval, now)) continue;
      if (!approval.traceId) continue;
      if (sessionKey && approval.sessionKey !== sessionKey) continue;
      const run = this.runs.resolveRunByTrace(approval.traceId);
      if (!run || isTerminalStatus(run.status)) continue;
      if (!selected || run.lastEventAtMs > selected.lastEventAtMs) {
        selected = run;
      }
    }

    if (!selected && sessionKey) {
      return this.runs.getLatestActiveRun(sessionKey) ?? this.runs.getMostRecentActiveRun();
    }

    return selected ?? this.runs.getMostRecentActiveRun();
  }

  recordApprovalRequest(params: {
    id: string;
    sessionKey?: string;
    command?: string;
    requestId?: string;
  }): RunState | null {
    const normalizedSessionKey = params.sessionKey?.trim();
    const fallbackRun = normalizedSessionKey
      ? (this.runs.getLatestActiveRun(normalizedSessionKey) ??
        this.runs.ensureRun({ sessionKey: normalizedSessionKey, clientRunId: params.id }))
      : this.runs.getMostRecentActiveRun();

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

    const requestedSession = params.sessionKey?.trim() || undefined;
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
      const runByApprovalTrace = this.runs.resolveRunByTrace(approval.traceId);
      if (runByApprovalTrace) {
        run = runByApprovalTrace;
        matchedByExactTrace = true;
      }
    }

    if (!run && requestedSession) {
      run =
        this.runs.getLatestActiveRun(requestedSession) ?? this.runs.getLatestRun(requestedSession);
    }

    if (!run && approval.sessionKey) {
      run =
        this.findRunFromRecentApproval(approval.sessionKey) ??
        this.runs.getLatestRun(approval.sessionKey);
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

  resetSession(sessionKey: string): void {
    for (const [approvalId, approval] of this.pendingApprovals) {
      if (approval.sessionKey === sessionKey) {
        this.pendingApprovals.delete(approvalId);
      }
    }
  }

  resetAll(): void {
    this.pendingApprovals.clear();
  }

  private getRunByTraceOrSession(traceId?: string, sessionKey?: string): RunState | null {
    if (traceId) {
      const runByTrace = this.runs.resolveRunByTrace(traceId);
      if (runByTrace) return runByTrace;
    }

    if (sessionKey) {
      const runBySession =
        this.runs.getLatestActiveRun(sessionKey) ?? this.runs.getLatestRun(sessionKey);
      if (runBySession) return runBySession;
    }

    return null;
  }
}
