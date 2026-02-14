export type ExecLifecycleStatus =
  | "pending_approval"
  | "running"
  | "completed"
  | "denied"
  | "timeout"
  | "error";

export type ExecLifecycleRecord = {
  lifecycleKey: string;
  runId: string;
  sessionKey: string;
  command: string;
  normalizedCommand: string;
  status: ExecLifecycleStatus;
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
}

export interface ExecLifecycleActions {
  upsert: (record: ExecLifecycleRecord) => void;
  upsertBatch: (records: ExecLifecycleRecord[]) => void;
  clearSession: (sessionKey: string) => void;
  reset: () => void;
}

export type ExecLifecycleStore = ExecLifecycleState & ExecLifecycleActions;
