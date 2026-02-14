import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { A2UIExecTraceStore, ExecTerminalRecord, ExecTraceRecord } from "./types";
import { initialState } from "./initialState";

function isSameTraceRecord(previous: ExecTraceRecord | undefined, next: ExecTraceRecord): boolean {
  if (!previous) return false;
  return (
    previous.traceKey === next.traceKey &&
    previous.sessionKey === next.sessionKey &&
    previous.toolCallId === next.toolCallId &&
    previous.toolOrder === next.toolOrder &&
    previous.command === next.command &&
    previous.status === next.status &&
    previous.startedAtMs === next.startedAtMs &&
    previous.endedAtMs === next.endedAtMs &&
    previous.durationMs === next.durationMs &&
    Object.is(previous.output, next.output) &&
    previous.errorText === next.errorText
  );
}

function isSameTerminalRecord(
  previous: ExecTerminalRecord | undefined,
  next: ExecTerminalRecord,
): boolean {
  if (!previous) return false;
  return (
    previous.traceKey === next.traceKey &&
    previous.endedAtMs === next.endedAtMs &&
    previous.toolOrder === next.toolOrder
  );
}

export const useA2UIExecTraceStore = create<A2UIExecTraceStore>()(
  devtools(
    (set) => ({
      ...initialState,
      setTrace: (trace) =>
        set(
          (state) => {
            const current = state.tracesByKey[trace.traceKey];
            if (isSameTraceRecord(current, trace)) return state;
            return {
              tracesByKey: {
                ...state.tracesByKey,
                [trace.traceKey]: trace,
              },
            };
          },
          false,
          "a2uiExecTrace/setTrace",
        ),
      setTerminal: (commandKey, terminal) =>
        set(
          (state) => {
            const current = state.terminalByCommand[commandKey];
            if (isSameTerminalRecord(current, terminal)) return state;
            return {
              terminalByCommand: {
                ...state.terminalByCommand,
                [commandKey]: terminal,
              },
            };
          },
          false,
          "a2uiExecTrace/setTerminal",
        ),
      setTraceIfChanged: (trace) =>
        set(
          (state) => {
            const current = state.tracesByKey[trace.traceKey];
            if (isSameTraceRecord(current, trace)) return state;
            return {
              tracesByKey: {
                ...state.tracesByKey,
                [trace.traceKey]: trace,
              },
            };
          },
          false,
          "a2uiExecTrace/setTraceIfChanged",
        ),
      setTerminalIfChanged: (commandKey, terminal) =>
        set(
          (state) => {
            const current = state.terminalByCommand[commandKey];
            if (isSameTerminalRecord(current, terminal)) return state;
            return {
              terminalByCommand: {
                ...state.terminalByCommand,
                [commandKey]: terminal,
              },
            };
          },
          false,
          "a2uiExecTrace/setTerminalIfChanged",
        ),
      batchSet: (updates) =>
        set(
          (state) => {
            if (!updates.length) return state;

            let nextTraces = state.tracesByKey;
            let nextTerminals = state.terminalByCommand;
            let tracesChanged = false;
            let terminalsChanged = false;

            for (const update of updates) {
              const trace = update.trace;
              const currentTrace = nextTraces[trace.traceKey];
              if (!isSameTraceRecord(currentTrace, trace)) {
                if (!tracesChanged) {
                  nextTraces = { ...nextTraces };
                  tracesChanged = true;
                }
                nextTraces[trace.traceKey] = trace;
              }

              if (!update.terminal) continue;
              const currentTerminal = nextTerminals[update.terminal.commandKey];
              if (isSameTerminalRecord(currentTerminal, update.terminal.terminal)) continue;
              if (!terminalsChanged) {
                nextTerminals = { ...nextTerminals };
                terminalsChanged = true;
              }
              nextTerminals[update.terminal.commandKey] = update.terminal.terminal;
            }

            if (!tracesChanged && !terminalsChanged) return state;
            return {
              tracesByKey: nextTraces,
              terminalByCommand: nextTerminals,
            };
          },
          false,
          "a2uiExecTrace/batchSet",
        ),
      clearSession: (sessionKey) =>
        set(
          (state) => {
            const prefix = `${sessionKey.trim()}::`;
            const nextTraces = Object.fromEntries(
              Object.entries(state.tracesByKey).filter(([key]) => !key.startsWith(prefix)),
            );
            const nextTerminal = Object.fromEntries(
              Object.entries(state.terminalByCommand).filter(([key]) => !key.startsWith(prefix)),
            );
            if (
              Object.keys(nextTraces).length === Object.keys(state.tracesByKey).length &&
              Object.keys(nextTerminal).length === Object.keys(state.terminalByCommand).length
            ) {
              return state;
            }
            return {
              tracesByKey: nextTraces,
              terminalByCommand: nextTerminal,
            };
          },
          false,
          "a2uiExecTrace/clearSession",
        ),
    }),
    { name: "A2UIExecTraceStore" },
  ),
);
