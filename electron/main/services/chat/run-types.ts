import type { ChatNormalizedRunEvent, ChatRunStatus } from "@clawui/types";

export const DEFAULT_PENDING_APPROVAL_TTL_MS = 120_000;
export const MAX_PENDING_APPROVAL_COUNT = 128;

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

export type RunEventBase = Omit<ChatNormalizedRunEvent, "kind">;
