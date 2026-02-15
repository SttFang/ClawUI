import type { DynamicToolUIPart } from "ai";
import { getCommandFromInput, makeExecApprovalKey, normalizeSessionKey } from "@/lib/exec";
import { useA2UIExecTraceStore, useExecApprovalsStore } from "@/store/exec";
import { deriveNextExecTrace, isTraceNewer, makeCommandKey } from "./derivation";
import {
  buildExecTraceKey,
  isExecPreliminary,
  isOutputStillRunning,
  type ExecTrace,
  type SuppressionContext,
} from "./types";

function isCommandActive(sessionKey: string, command: string): boolean {
  const normalizedSession = normalizeSessionKey(sessionKey);
  const normalizedCommand = command.trim();
  if (!normalizedSession || !normalizedCommand) return false;

  const state = useExecApprovalsStore.getState();
  const hasPending = state.queue.some(
    (entry) =>
      normalizeSessionKey(entry.request.sessionKey) === normalizedSession &&
      (entry.request.command ?? "").trim() === normalizedCommand,
  );
  if (hasPending) return true;

  const runningKey = makeExecApprovalKey(normalizedSession, normalizedCommand);
  return Boolean(state.runningByKey[runningKey]);
}

function hasSiblingActiveTrace(
  tracesByKey: Record<string, ExecTrace>,
  sessionKey: string,
  command: string,
  current: ExecTrace,
): boolean {
  const normalizedCommand = command.trim();
  for (const trace of Object.values(tracesByKey)) {
    if (trace.traceKey === current.traceKey) continue;
    if (trace.sessionKey !== sessionKey) continue;
    if (trace.command.trim() !== normalizedCommand) continue;
    if (trace.status === "completed" || trace.status === "error") continue;
    return true;
  }
  return false;
}

function hasNewerActiveTrace(
  tracesByKey: Record<string, ExecTrace>,
  sessionKey: string,
  command: string,
  current: ExecTrace,
): boolean {
  const normalizedCommand = command.trim();
  for (const trace of Object.values(tracesByKey)) {
    if (trace.traceKey === current.traceKey) continue;
    if (trace.sessionKey !== sessionKey) continue;
    if (trace.command.trim() !== normalizedCommand) continue;
    if (trace.status === "completed" || trace.status === "error") continue;
    if (isTraceNewer(trace, current)) return true;
  }
  return false;
}

export function shouldSuppressExecPart(
  part: DynamicToolUIPart,
  sessionKey?: string,
  context?: SuppressionContext,
): boolean {
  const normalizedSessionKey = sessionKey ?? "";
  const snapshot = useA2UIExecTraceStore.getState();
  const tracesByKey = context?.tracesByKey ?? snapshot.tracesByKey;
  const terminalByCommand = context?.terminalByCommand ?? snapshot.terminalByCommand;
  const traceKey = buildExecTraceKey(normalizedSessionKey, part.toolCallId);
  const existing = tracesByKey[traceKey];
  const commandCandidate = getCommandFromInput(part.input) || existing?.command || "";
  const commandKey = commandCandidate ? makeCommandKey(normalizedSessionKey, commandCandidate) : "";
  const currentTerminal = commandKey ? terminalByCommand[commandKey] : undefined;
  const trace =
    context?.trace ??
    deriveNextExecTrace({
      part,
      sessionKey: normalizedSessionKey,
      existing,
      currentTerminal,
    }).nextTrace;
  const command = trace.command.trim();
  const explicitCommand = getCommandFromInput(part.input);
  const isPartTerminal =
    part.state === "output-error" ||
    (part.state === "output-available" && !isExecPreliminary(part) && !isOutputStillRunning(part));
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
    return hasSiblingActiveTrace(tracesByKey, normalizedSessionKey, command, trace);
  }

  if (!command) return false;
  if (hasNewerActiveTrace(tracesByKey, normalizedSessionKey, command, trace)) return true;
  const terminal = terminalByCommand[makeCommandKey(normalizedSessionKey, command)];
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
