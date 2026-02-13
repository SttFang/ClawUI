export type ExecTraceStatus = "waiting" | "running" | "completed" | "error";

export type ExecTraceRecord = {
  traceKey: string;
  sessionKey: string;
  toolCallId: string;
  toolOrder: number | null;
  command: string;
  status: ExecTraceStatus;
  startedAtMs: number;
  endedAtMs?: number;
  durationMs?: number;
  output?: unknown;
  errorText?: string;
};

export type ExecTerminalRecord = {
  traceKey: string;
  endedAtMs: number;
  toolOrder: number | null;
};

export interface A2UIExecTraceState {
  tracesByKey: Record<string, ExecTraceRecord>;
  terminalByCommand: Record<string, ExecTerminalRecord>;
}

export interface A2UIExecTraceActions {
  setTrace: (trace: ExecTraceRecord) => void;
  setTerminal: (commandKey: string, terminal: ExecTerminalRecord) => void;
  clearSession: (sessionKey: string) => void;
}

export type A2UIExecTraceStore = A2UIExecTraceState & A2UIExecTraceActions;
