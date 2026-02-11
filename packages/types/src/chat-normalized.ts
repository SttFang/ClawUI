// ============================================
// Chat Normalized Run Events (ClawUI internal)
// ============================================

export type ChatRunStatus =
  | "queued"
  | "started"
  | "waiting_approval"
  | "running"
  | "completed"
  | "failed"
  | "aborted";

export type ChatNormalizedRunEventKind =
  | "run.started"
  | "run.waiting_approval"
  | "run.approval_resolved"
  | "run.running"
  | "run.delta"
  | "run.tool_started"
  | "run.tool_updated"
  | "run.tool_finished"
  | "run.lifecycle"
  | "run.completed"
  | "run.failed"
  | "run.aborted"
  | "run.degraded_recovered";

export interface ChatNormalizedRunEvent {
  kind: ChatNormalizedRunEventKind;
  traceId: string;
  timestampMs: number;
  sessionKey: string;
  clientRunId: string;
  agentRunId?: string;
  approvalId?: string;
  command?: string;
  decision?: "allow-once" | "allow-always" | "deny";
  status?: ChatRunStatus;
  text?: string;
  error?: string;
  rawEventName?: string;
  rawSeq?: number;
  metadata?: Record<string, unknown>;
}
