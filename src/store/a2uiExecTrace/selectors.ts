import type { A2UIExecTraceState } from "./types";

export const selectTraces = (state: A2UIExecTraceState) => state.tracesByKey;
export const selectTerminals = (state: A2UIExecTraceState) => state.terminalByCommand;

export const selectTraceByKey = (key: string) => (state: A2UIExecTraceState) =>
  state.tracesByKey[key];

export const selectTerminalByKey = (key: string) => (state: A2UIExecTraceState) =>
  state.terminalByCommand[key];

export const a2uiExecTraceSelectors = {
  selectTraces,
  selectTerminals,
  selectTraceByKey,
  selectTerminalByKey,
};
