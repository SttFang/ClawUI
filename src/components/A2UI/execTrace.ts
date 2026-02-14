import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ExecTraceRecord } from "@/store/a2uiExecTrace/types";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { normalizeSessionKey } from "@/store/execApprovals/helpers";

export type { ExecTraceStatus } from "@/store/a2uiExecTrace/types";

export type ExecTrace = ExecTraceRecord;

function makeCommandKey(sessionKey: string, command: string): string {
  return `${sessionKey}::${command.trim()}`;
}

function isCommandActive(sessionKey: string, command: string): boolean {
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  const normalizedCommand = command.trim();
  if (!normalizedSessionKey || !normalizedCommand) return false;

  const state = useExecApprovalsStore.getState();
  const hasPending = state.queue.some(
    (entry) =>
      normalizeSessionKey(entry.request.sessionKey) === normalizedSessionKey &&
      (entry.request.command ?? "").trim() === normalizedCommand,
  );
  if (hasPending) return true;

  const runningKey = makeExecApprovalKey(normalizedSessionKey, normalizedCommand);
  return Boolean(state.runningByKey[runningKey]);
}

function isTraceNewer(candidate: ExecTrace, current: ExecTrace): boolean {
  if (candidate.toolOrder !== null && current.toolOrder !== null) {
    return candidate.toolOrder > current.toolOrder;
  }
  if (candidate.toolOrder !== null && current.toolOrder === null) return true;
  if (candidate.toolOrder === null && current.toolOrder !== null) return false;
  if (candidate.startedAtMs !== current.startedAtMs) {
    return candidate.startedAtMs > current.startedAtMs;
  }
  return candidate.traceKey > current.traceKey;
}

function hasSiblingActiveTrace(sessionKey: string, command: string, current: ExecTrace): boolean {
  const traces = useA2UIExecTraceStore.getState().tracesByKey;
  const normalizedCommand = command.trim();
  for (const trace of Object.values(traces)) {
    if (trace.traceKey === current.traceKey) continue;
    if (trace.sessionKey !== sessionKey) continue;
    if (trace.command.trim() !== normalizedCommand) continue;
    if (trace.status === "completed" || trace.status === "error") continue;
    return true;
  }
  return false;
}

function hasNewerActiveTrace(sessionKey: string, command: string, current: ExecTrace): boolean {
  const traces = useA2UIExecTraceStore.getState().tracesByKey;
  const normalizedCommand = command.trim();
  for (const trace of Object.values(traces)) {
    if (trace.traceKey === current.traceKey) continue;
    if (trace.sessionKey !== sessionKey) continue;
    if (trace.command.trim() !== normalizedCommand) continue;
    if (trace.status === "completed" || trace.status === "error") continue;
    if (isTraceNewer(trace, current)) return true;
  }
  return false;
}

function parseToolOrder(toolCallId: string): number | null {
  const assistantMatch = toolCallId.match(/assistant:(\d{10,})/);
  if (assistantMatch) {
    const parsed = Number.parseInt(assistantMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const tsMatch = toolCallId.match(/:(\d{10,})(?::|$)/);
  if (tsMatch) {
    const parsed = Number.parseInt(tsMatch[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function clearTracesForSession(sessionKey: string): void {
  const normalizedSessionKey = sessionKey.trim();
  if (!normalizedSessionKey) return;
  useA2UIExecTraceStore.getState().clearSession(normalizedSessionKey);
}

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
  if (part.type !== "dynamic-tool") return false;
  const name = part.toolName.trim().toLowerCase();
  return name === "exec" || name === "bash";
}

export function upsertExecTrace(part: DynamicToolUIPart, sessionKey?: string): ExecTrace {
  const normalizedSessionKey = sessionKey ?? "";
  const traceKey = `${normalizedSessionKey}::${part.toolCallId}`;
  const now = Date.now();
  const existing = useA2UIExecTraceStore.getState().tracesByKey[traceKey];
  const command = getCommand(part.input);
  const incomingFinal =
    part.state === "output-error" ||
    (part.state === "output-available" && !isExecPreliminary(part));

  const base: ExecTrace = existing ?? {
    traceKey,
    sessionKey: normalizedSessionKey,
    toolCallId: part.toolCallId,
    toolOrder: parseToolOrder(part.toolCallId),
    command: command || "exec",
    status: "running",
    startedAtMs: now,
  };

  const next: ExecTrace = {
    ...base,
    command: command || base.command,
  };

  // Guard against out-of-order events. Once a trace reaches terminal status,
  // ignore subsequent non-terminal updates for the same toolCallId.
  if (existing && (existing.status === "completed" || existing.status === "error")) {
    if (!incomingFinal) return existing;
    if (existing.status === "completed" && part.state === "output-error") return existing;
    if (
      existing.status === "error" &&
      part.state === "output-available" &&
      !isExecPreliminary(part)
    ) {
      return existing;
    }
  }

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
    }
  } else if (part.state === "output-error") {
    next.status = "error";
    next.endedAtMs = base.endedAtMs ?? now;
    next.durationMs = Math.max(0, next.endedAtMs - next.startedAtMs);
    next.errorText = part.errorText;
  }

  useA2UIExecTraceStore.getState().setTrace(next);
  if ((next.status === "completed" || next.status === "error") && next.command.trim()) {
    const commandKey = makeCommandKey(normalizedSessionKey, next.command);
    const endedAtMs = next.endedAtMs ?? now;
    const current = useA2UIExecTraceStore.getState().terminalByCommand[commandKey];
    const incomingOrder = next.toolOrder;
    const shouldReplace = (() => {
      if (!current) return true;
      if (incomingOrder !== null && current.toolOrder !== null) {
        return incomingOrder >= current.toolOrder;
      }
      if (incomingOrder !== null && current.toolOrder === null) {
        return true;
      }
      if (incomingOrder === null && current.toolOrder !== null) {
        return false;
      }
      return endedAtMs >= current.endedAtMs;
    })();

    if (shouldReplace) {
      useA2UIExecTraceStore.getState().setTerminal(commandKey, {
        traceKey,
        endedAtMs,
        toolOrder: incomingOrder,
      });
    }
  }
  return next;
}

export function shouldSuppressExecPart(part: DynamicToolUIPart, sessionKey?: string): boolean {
  const trace = upsertExecTrace(part, sessionKey);
  const normalizedSessionKey = sessionKey ?? "";
  const command = trace.command.trim();
  const explicitCommand = getCommand(part.input);
  const isPartTerminal =
    part.state === "output-error" ||
    (part.state === "output-available" && !isExecPreliminary(part));
  const isFallbackExecTerminal =
    !explicitCommand &&
    command.toLowerCase() === "exec" &&
    (trace.status === "completed" || trace.status === "error");

  if (isFallbackExecTerminal) {
    return true;
  }

  // Cross-message dedupe:
  // Once this toolCallId reached terminal, suppress older non-terminal snapshots
  // from history replay (input-available / preliminary output-available).
  if ((trace.status === "completed" || trace.status === "error") && !isPartTerminal) {
    return true;
  }

  if (trace.status === "completed" || trace.status === "error") {
    if (!command) return false;
    if (!isCommandActive(normalizedSessionKey, command)) return false;
    return hasSiblingActiveTrace(normalizedSessionKey, command, trace);
  }

  if (!command) return false;
  if (hasNewerActiveTrace(normalizedSessionKey, command, trace)) return true;
  const commandKey = makeCommandKey(normalizedSessionKey, command);
  const terminal = useA2UIExecTraceStore.getState().terminalByCommand[commandKey];
  if (!terminal) return false;
  if (terminal.traceKey === trace.traceKey) return false;
  const commandActive = isCommandActive(normalizedSessionKey, command);
  if (commandActive) {
    if (trace.toolOrder !== null && terminal.toolOrder !== null) {
      return trace.toolOrder < terminal.toolOrder;
    }
    return false;
  }
  if (trace.startedAtMs > terminal.endedAtMs) return false;

  if (
    trace.toolOrder !== null &&
    terminal.toolOrder !== null &&
    trace.toolOrder > terminal.toolOrder
  ) {
    return false;
  }
  return true;
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
