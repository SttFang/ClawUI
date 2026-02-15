import type { DynamicToolUIPart } from "ai";
import type { ExecTerminalRecord, ExecTraceRecord } from "@/store/exec";

export type { ExecTraceStatus } from "@/store/exec";

export type ExecTrace = ExecTraceRecord;

export type ExecTraceContext = {
  tracesByKey: Record<string, ExecTrace>;
  terminalByCommand: Record<string, ExecTerminalRecord>;
};

export type DeriveNextExecTraceParams = {
  part: DynamicToolUIPart;
  sessionKey?: string;
  existing?: ExecTrace;
  currentTerminal?: ExecTerminalRecord;
  now?: number;
};

export type DeriveNextExecTraceResult = {
  nextTrace: ExecTrace;
  commandKey?: string;
  nextTerminal?: ExecTerminalRecord;
};

export type SuppressionContext = {
  trace?: ExecTrace;
  tracesByKey?: Record<string, ExecTrace>;
  terminalByCommand?: Record<string, ExecTerminalRecord>;
};

export function buildExecTraceKey(sessionKey: string | undefined, toolCallId: string): string {
  return `${sessionKey ?? ""}::${toolCallId}`;
}

export function isExecPreliminary(part: DynamicToolUIPart): boolean {
  const maybe = (part as unknown as { preliminary?: unknown }).preliminary;
  return maybe === true;
}

export function isOutputStillRunning(part: DynamicToolUIPart): boolean {
  if (part.state !== "output-available") return false;
  if (typeof part.output !== "string") return false;
  return part.output.includes("Command still running (session ");
}
