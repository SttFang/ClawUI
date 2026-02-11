import type { DynamicToolUIPart, UIMessage } from "ai";
import { useExecApprovalsStore } from "@/store/execApprovals";

export type ExecTraceStatus = "waiting" | "running" | "completed" | "error";

export type ExecTrace = {
  traceKey: string;
  sessionKey: string;
  toolCallId: string;
  command: string;
  status: ExecTraceStatus;
  startedAtMs: number;
  endedAtMs?: number;
  durationMs?: number;
  output?: unknown;
  errorText?: string;
};

type ExecTraceCache = ExecTrace;

const traceCache = new Map<string, ExecTraceCache>();

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function getCommand(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const command = record.command;
  return typeof command === "string" ? command.trim() : "";
}

export function isExecPreliminary(part: DynamicToolUIPart): boolean {
  const maybe = (part as unknown as { preliminary?: unknown }).preliminary;
  return maybe === true;
}

export function isExecPart(part: UIMessage["parts"][number]): part is DynamicToolUIPart {
  return part.type === "dynamic-tool" && part.toolName === "exec";
}

export function upsertExecTrace(part: DynamicToolUIPart, sessionKey?: string): ExecTrace {
  const normalizedSessionKey = sessionKey ?? "";
  const traceKey = `${normalizedSessionKey}::${part.toolCallId}`;
  const now = Date.now();
  const existing = traceCache.get(traceKey);
  const command = getCommand(part.input);

  const base: ExecTrace = existing ?? {
    traceKey,
    sessionKey: normalizedSessionKey,
    toolCallId: part.toolCallId,
    command: command || "exec",
    status: "running",
    startedAtMs: now,
  };

  const next: ExecTrace = {
    ...base,
    command: command || base.command,
  };

  if (part.state === "input-available" || part.state === "input-streaming") {
    next.status = "running";
    next.startedAtMs = base.startedAtMs || now;
  } else if (part.state === "output-available") {
    if (isExecPreliminary(part)) {
      next.status = "running";
    } else {
      next.status = "completed";
      next.endedAtMs = base.endedAtMs ?? now;
      next.durationMs = Math.max(0, next.endedAtMs - next.startedAtMs);
      next.output = part.output;
      if (next.command) {
        useExecApprovalsStore.getState().clearRunning(next.sessionKey, next.command);
      }
    }
  } else if (part.state === "output-error") {
    next.status = "error";
    next.endedAtMs = base.endedAtMs ?? now;
    next.durationMs = Math.max(0, next.endedAtMs - next.startedAtMs);
    next.errorText = part.errorText;
    if (next.command) {
      useExecApprovalsStore.getState().clearRunning(next.sessionKey, next.command);
    }
  }

  traceCache.set(traceKey, next);
  return next;
}

export function collectCompletedExecTraces(
  parts: UIMessage["parts"],
  sessionKey?: string,
): ExecTrace[] {
  const traces: ExecTrace[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!isExecPart(part)) continue;
    const trace = upsertExecTrace(part, sessionKey);
    if (trace.status !== "completed" && trace.status !== "error") continue;
    if (seen.has(trace.traceKey)) continue;
    seen.add(trace.traceKey);
    traces.push(trace);
  }

  return traces.sort((a, b) => a.startedAtMs - b.startedAtMs);
}
