import type { DynamicToolUIPart, UIMessage } from "ai";
import type {
  A2UIExecTraceState,
  ExecTerminalRecord,
  ExecTraceRecord,
  ExecTraceUpdatePayload,
} from "@/store/exec";
import { getCommandFromInput } from "@/lib/exec";
import { useA2UIExecTraceStore } from "@/store/exec";
import type { DeriveNextExecTraceResult, ExecTrace, ExecTraceContext } from "./types";
import { deriveNextExecTrace, makeCommandKey } from "./derivation";

export type { ExecTraceStatus, ExecTrace, ExecTraceContext, SuppressionContext } from "./types";
export { buildExecTraceKey, isExecPreliminary, isOutputStillRunning } from "./types";
export {
  deriveNextExecTrace,
  makeCommandKey,
  isTraceNewer,
  parseToolOrder,
  resolveTerminalUpdate,
} from "./derivation";
export { shouldSuppressExecPart } from "./suppression";

export function isExecPart(part: UIMessage["parts"][number]): part is DynamicToolUIPart {
  if (part.type !== "dynamic-tool") return false;
  const name = part.toolName.trim().toLowerCase();
  return name === "exec" || name === "bash";
}

export function clearTracesForSession(sessionKey: string): void {
  const normalizedSession = sessionKey.trim();
  if (!normalizedSession) return;
  useA2UIExecTraceStore.getState().clearSession(normalizedSession);
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
  const traceKey = `${normalizedSessionKey}::${params.part.toolCallId}`;
  const state = useA2UIExecTraceStore.getState();
  const existing = state.tracesByKey[traceKey];
  const commandCandidate = getCommandFromInput(params.part.input) || existing?.command || "";
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
    const traceKey = `${normalizedSessionKey}::${part.toolCallId}`;
    const existing = context.tracesByKey[traceKey];
    const commandCandidate = getCommandFromInput(part.input) || existing?.command || "";
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
