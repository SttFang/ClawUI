export type ExecLifecycleStatus =
  | "pending_approval"
  | "running"
  | "completed"
  | "denied"
  | "timeout"
  | "error";

export type ExecLifecycleRecord = {
  attemptId: string;
  lifecycleKey: string;
  runId: string;
  sessionKey: string;
  command: string;
  normalizedCommand: string;
  status: ExecLifecycleStatus;
  gatewayId?: string;
  requestId?: string;
  decision?: "allow-once" | "allow-always" | "deny" | "timeout";
  toolCallId: string;
  toolName: string;
  messageId: string;
  partIndex: number;
  partState: string;
  preliminary: boolean;
  startedAtMs: number;
  updatedAtMs: number;
  endedAtMs?: number;
  approvalId?: string;
  cwd?: string;
  yieldMs?: number;
  errorText?: string;
  sourceToolCallIds: string[];
};

export interface ExecLifecycleState {
  recordsByKey: Record<string, ExecLifecycleRecord>;
  attemptIdByApprovalId: Record<string, string>;
  attemptIdByGatewayId: Record<string, string>;
  attemptIdByToolCallId: Record<string, string>;
  latestAttemptIdBySessionCommand: Record<string, string>;
}

export interface ExecLifecycleActions {
  upsert: (record: ExecLifecycleRecord) => void;
  upsertBatch: (records: ExecLifecycleRecord[]) => void;
  clearSession: (sessionKey: string) => void;
  reset: () => void;
}

export type ExecLifecycleStore = ExecLifecycleState & ExecLifecycleActions;
