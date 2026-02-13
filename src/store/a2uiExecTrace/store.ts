import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { A2UIExecTraceStore } from "./types";
import { initialState } from "./initialState";

export const useA2UIExecTraceStore = create<A2UIExecTraceStore>()(
  devtools(
    (set) => ({
      ...initialState,
      setTrace: (trace) =>
        set(
          (state) => ({
            tracesByKey: {
              ...state.tracesByKey,
              [trace.traceKey]: trace,
            },
          }),
          false,
          "a2uiExecTrace/setTrace",
        ),
      setTerminal: (commandKey, terminal) =>
        set(
          (state) => ({
            terminalByCommand: {
              ...state.terminalByCommand,
              [commandKey]: terminal,
            },
          }),
          false,
          "a2uiExecTrace/setTerminal",
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
