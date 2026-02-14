import type { ExecTerminalRecord } from "@/store/exec";
import { getCommandFromInput } from "@/lib/exec";
import {
  buildExecTraceKey,
  isExecPreliminary,
  type DeriveNextExecTraceParams,
  type DeriveNextExecTraceResult,
  type ExecTrace,
} from "./types";

export function makeCommandKey(sessionKey: string, command: string): string {
  return `${sessionKey}::${command.trim()}`;
}

export function isTraceNewer(candidate: ExecTrace, current: ExecTrace): boolean {
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

export function parseToolOrder(toolCallId: string): number | null {
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

export function resolveTerminalUpdate(params: {
  trace: ExecTrace;
  normalizedSessionKey: string;
  currentTerminal?: ExecTerminalRecord;
  now: number;
}): { commandKey?: string; nextTerminal?: ExecTerminalRecord } {
  const command = params.trace.command.trim();
  if (!command) return {};
  if (params.trace.status !== "completed" && params.trace.status !== "error") return {};

  const commandKey = makeCommandKey(params.normalizedSessionKey, command);
  const endedAtMs = params.trace.endedAtMs ?? params.now;
  const incomingOrder = params.trace.toolOrder;
  const current = params.currentTerminal;
  const shouldReplace = (() => {
    if (!current) return true;
    if (incomingOrder !== null && current.toolOrder !== null)
      return incomingOrder >= current.toolOrder;
    if (incomingOrder !== null && current.toolOrder === null) return true;
    if (incomingOrder === null && current.toolOrder !== null) return false;
    return endedAtMs >= current.endedAtMs;
  })();

  if (!shouldReplace) return { commandKey };
  return {
    commandKey,
    nextTerminal: {
      traceKey: params.trace.traceKey,
      endedAtMs,
      toolOrder: incomingOrder,
    },
  };
}

export function deriveNextExecTrace(params: DeriveNextExecTraceParams): DeriveNextExecTraceResult {
  const normalizedSessionKey = params.sessionKey ?? "";
  const now = params.now ?? Date.now();
  const traceKey = buildExecTraceKey(normalizedSessionKey, params.part.toolCallId);
  const command = getCommandFromInput(params.part.input);
  const incomingFinal =
    params.part.state === "output-error" ||
    (params.part.state === "output-available" && !isExecPreliminary(params.part));

  const base: ExecTrace = params.existing ?? {
    traceKey,
    sessionKey: normalizedSessionKey,
    toolCallId: params.part.toolCallId,
    toolOrder: parseToolOrder(params.part.toolCallId),
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
  if (
    params.existing &&
    (params.existing.status === "completed" || params.existing.status === "error")
  ) {
    if (!incomingFinal) {
      const terminalResolved = resolveTerminalUpdate({
        trace: params.existing,
        normalizedSessionKey,
        currentTerminal: params.currentTerminal,
        now,
      });
      return {
        nextTrace: params.existing,
        commandKey: terminalResolved.commandKey,
        nextTerminal: terminalResolved.nextTerminal,
      };
    }
    if (params.existing.status === "completed" && params.part.state === "output-error") {
      const terminalResolved = resolveTerminalUpdate({
        trace: params.existing,
        normalizedSessionKey,
        currentTerminal: params.currentTerminal,
        now,
      });
      return {
        nextTrace: params.existing,
        commandKey: terminalResolved.commandKey,
        nextTerminal: terminalResolved.nextTerminal,
      };
    }
    if (
      params.existing.status === "error" &&
      params.part.state === "output-available" &&
      !isExecPreliminary(params.part)
    ) {
      const terminalResolved = resolveTerminalUpdate({
        trace: params.existing,
        normalizedSessionKey,
        currentTerminal: params.currentTerminal,
        now,
      });
      return {
        nextTrace: params.existing,
        commandKey: terminalResolved.commandKey,
        nextTerminal: terminalResolved.nextTerminal,
      };
    }
  }

  if (params.part.state === "input-available" || params.part.state === "input-streaming") {
    next.status = "running";
    next.startedAtMs = base.startedAtMs || now;
    delete next.endedAtMs;
    delete next.durationMs;
    delete next.output;
    delete next.errorText;
  } else if (params.part.state === "output-available") {
    if (isExecPreliminary(params.part)) {
      next.status = "running";
      delete next.endedAtMs;
      delete next.durationMs;
      delete next.output;
      delete next.errorText;
    } else {
      next.status = "completed";
      next.endedAtMs = base.endedAtMs ?? now;
      next.durationMs = Math.max(0, next.endedAtMs - next.startedAtMs);
      next.output = params.part.output;
      delete next.errorText;
    }
  } else if (params.part.state === "output-error") {
    next.status = "error";
    next.endedAtMs = base.endedAtMs ?? now;
    next.durationMs = Math.max(0, next.endedAtMs - next.startedAtMs);
    next.errorText = params.part.errorText;
    delete next.output;
  }

  const terminalResolved = resolveTerminalUpdate({
    trace: next,
    normalizedSessionKey,
    currentTerminal: params.currentTerminal,
    now,
  });
  return {
    nextTrace: next,
    commandKey: terminalResolved.commandKey,
    nextTerminal: terminalResolved.nextTerminal,
  };
}
