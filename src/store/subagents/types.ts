export type SubagentStatus = "spawning" | "running" | "done" | "error" | "timeout";

export interface SubagentNode {
  runId: string;
  sessionKey: string;
  parentSessionKey: string;
  label?: string;
  task: string;
  model?: string;
  status: SubagentStatus;
  createdAt: number;
  endedAt?: number;
  error?: string;
}

export interface SubagentHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestampMs?: number;
}

export interface SubagentsState {
  nodes: Record<string, SubagentNode>;
  selectedRunId: string | null;
  panelOpen: boolean;
  historyByRunId: Record<string, SubagentHistoryMessage[]>;
}

export interface SubagentsActions {
  add: (node: SubagentNode) => void;
  updateStatus: (runId: string, status: SubagentStatus, error?: string) => void;
  select: (runId: string | null) => void;
  togglePanel: (open?: boolean) => void;
  setHistory: (runId: string, messages: SubagentHistoryMessage[]) => void;
  remove: (runId: string) => void;
  reset: () => void;
}

export type SubagentsStore = SubagentsState & SubagentsActions;
