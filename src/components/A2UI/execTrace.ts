import type { DynamicToolUIPart, UIMessage } from "ai";
import type {
  A2UIExecTraceState,
  ExecTerminalRecord,
  ExecTraceRecord,
  ExecTraceUpdatePayload,
} from "@/store/a2uiExecTrace/types";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import { normalizeSessionKey } from "@/store/execApprovals/helpers";

export type { ExecTraceStatus } from "@/store/a2uiExecTrace/types";

export type ExecTrace = ExecTraceRecord;

export type ExecTraceContext = {
  tracesByKey: Record<string, ExecTrace>;
  terminalByCommand: Record<string, ExecTerminalRecord>;
};

type DeriveNextExecTraceParams = {
  part: DynamicToolUIPart;
  sessionKey?: string;
  existing?: ExecTrace;
  currentTerminal?: ExecTerminalRecord;
  now?: number;
};

type DeriveNextExecTraceResult = {
  nextTrace: ExecTrace;
  commandKey?: string;
  nextTerminal?: ExecTerminalRecord;
};

type SuppressionContext = {
  trace?: ExecTrace;
  tracesByKey?: Record<string, ExecTrace>;
  terminalByCommand?: Record<string, ExecTerminalRecord>;
};

function makeCommandKey(sessionKey: string, command: string): string {
  return `${sessionKey}::${command.trim()}`;
}

export function buildExecTraceKey(sessionKey: string | undefined, toolCallId: string): string {
  return `${sessionKey ?? ""}::${toolCallId}`;
}

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
  const normalizedSession = sessionKey.trim();
  if (!normalizedSession) return;
  useA2UIExecTraceStore.getState().clearSession(normalizedSession);
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

function resolveTerminalUpdate(params: {
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
  const command = getCommand(params.part.input);
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

export function createExecTraceContext(): ExecTraceContext {
  const snapshot = useA2UIExecTraceStore.getState();
  return {
    tracesByKey: { ...snapshot.tracesByKey },
    terminalByCommand: { ...snapshot.terminalByCommand },
  };
}

export function applyExecTraceUpdateToContext(
  context: ExecTraceContext,
  update: DeriveNextExecTraceResult,
): void {
  context.tracesByKey[update.nextTrace.traceKey] = update.nextTrace;
  if (update.commandKey && update.nextTerminal) {
    context.terminalByCommand[update.commandKey] = update.nextTerminal;
  }
}

export function commitExecTraceUpdate(params: {
  part: DynamicToolUIPart;
  sessionKey?: string;
  now?: number;
}): ExecTrace {
  const normalizedSessionKey = params.sessionKey ?? "";
  const traceKey = buildExecTraceKey(normalizedSessionKey, params.part.toolCallId);
  const state = useA2UIExecTraceStore.getState();
  const existing = state.tracesByKey[traceKey];
  const commandCandidate = getCommand(params.part.input) || existing?.command || "";
  const commandKey = commandCandidate ? makeCommandKey(normalizedSessionKey, commandCandidate) : "";
  const currentTerminal = commandKey ? state.terminalByCommand[commandKey] : undefined;
  const derived = deriveNextExecTrace({
    part: params.part,
    sessionKey: normalizedSessionKey,
    existing,
    currentTerminal,
    now: params.now,
  });

  const payload: ExecTraceUpdatePayload = {
    trace: derived.nextTrace,
    terminal:
      derived.commandKey && derived.nextTerminal
        ? { commandKey: derived.commandKey, terminal: derived.nextTerminal }
        : undefined,
  };
  useA2UIExecTraceStore.getState().batchSet([payload]);
  return derived.nextTrace;
}

export function selectTraceByKey(
  state: A2UIExecTraceState,
  traceKey: string,
): ExecTraceRecord | null {
  return state.tracesByKey[traceKey] ?? null;
}

export function selectTerminalByCommandKey(
  state: A2UIExecTraceState,
  commandKey: string,
): ExecTerminalRecord | null {
  return state.terminalByCommand[commandKey] ?? null;
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
  const commandCandidate = getCommand(part.input) || existing?.command || "";
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

export function collectCompletedExecTraces(
  parts: UIMessage["parts"],
  sessionKey?: string,
): ExecTrace[] {
  const traces: ExecTrace[] = [];
  const seen = new Set<string>();
  const context = createExecTraceContext();
  const now = Date.now();
  const normalizedSessionKey = sessionKey ?? "";

  for (const part of parts) {
    if (!isExecPart(part)) continue;
    const traceKey = buildExecTraceKey(normalizedSessionKey, part.toolCallId);
    const existing = context.tracesByKey[traceKey];
    const commandCandidate = getCommand(part.input) || existing?.command || "";
    const commandKey = commandCandidate
      ? makeCommandKey(normalizedSessionKey, commandCandidate)
      : "";
    const currentTerminal = commandKey ? context.terminalByCommand[commandKey] : undefined;
    const derived = deriveNextExecTrace({
      part,
      sessionKey: normalizedSessionKey,
      existing,
      currentTerminal,
      now,
    });
    applyExecTraceUpdateToContext(context, derived);

    const trace = derived.nextTrace;
    if (trace.status !== "completed" && trace.status !== "error") continue;
    if (seen.has(trace.traceKey)) continue;
    seen.add(trace.traceKey);
    traces.push(trace);
  }

  return traces.sort((a, b) => a.startedAtMs - b.startedAtMs);
}
