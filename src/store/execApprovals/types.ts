export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";

export type ExecApprovalRequestPayload = {
  command: string;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  agentId?: string | null;
  resolvedPath?: string | null;
  sessionKey?: string | null;
  traceId?: string | null;
  runId?: string | null;
  toolCallId?: string | null;
};

export type ExecApprovalRequest = {
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
};

export type LastResolvedApproval = {
  id: string;
  decision: ExecApprovalDecision;
  atMs: number;
};

export interface ExecApprovalsState {
  queue: ExecApprovalRequest[];
  busyById: Record<string, boolean>;
  runningByKey: Record<string, number>;
  lastResolvedBySession: Record<string, LastResolvedApproval>;
}

export interface ExecApprovalsActions {
  add: (entry: ExecApprovalRequest) => void;
  remove: (id: string) => void;
  clearRunning: (sessionKey: string | null | undefined, command: string) => void;
  clearRunningForSession: (sessionKey: string | null | undefined) => void;
  resolve: (id: string, decision: ExecApprovalDecision) => Promise<void>;
}

export type ExecApprovalsStore = ExecApprovalsState & ExecApprovalsActions;
