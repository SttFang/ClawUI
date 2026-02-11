export type RunNodeType = "chat" | "approval" | "agent" | "system";

export type RunStatus =
  | "queued"
  | "started"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "aborted";

export type RunSource = "chat.send" | "agent.event" | "approval.event" | "fallback";

export interface RunNode {
  runId: string;
  sessionKey: string;
  type: RunNodeType;
  status: RunStatus;
  source: RunSource;
  parentRunId?: string;
  clientRunId?: string;
  agentRunId?: string;
  startedAtMs: number;
  updatedAtMs: number;
  endedAtMs?: number;
}

export interface ApprovalNode {
  approvalId: string;
  sessionKey: string;
  relatedRunId?: string;
  status: "pending" | "resolved" | "expired";
  decision?: "allow-once" | "allow-always" | "deny";
  command?: string;
  createdAtMs: number;
  resolvedAtMs?: number;
}

export interface ToolCallNode {
  toolCallId: string;
  sessionKey: string;
  runId: string;
  toolName: string;
  phase: "start" | "update" | "result" | "error" | "end";
  status: "running" | "completed" | "error";
  createdAtMs: number;
  updatedAtMs: number;
}

export interface TimelineEvent {
  id: string;
  sessionKey: string;
  atMs: number;
  kind: string;
  runId?: string;
  approvalId?: string;
  toolCallId?: string;
  payload?: Record<string, unknown>;
}

export interface SessionRunMap {
  rootChatRunId?: string;
  runsById: Record<string, RunNode>;
  approvalsById: Record<string, ApprovalNode>;
  toolCallsById: Record<string, ToolCallNode>;
  timeline: TimelineEvent[];
  indexes: {
    runIdByAgentRunId: Record<string, string>;
    runIdByClientRunId: Record<string, string>;
    approvalIdsByRunId: Record<string, string[]>;
    toolCallIdsByRunId: Record<string, string[]>;
  };
}
