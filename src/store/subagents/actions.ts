import type { SubagentsActions, SubagentsStore, SubagentStatus } from "./types";
import { initialState } from "./initialState";

type Set = (
  partial: Partial<SubagentsStore> | ((state: SubagentsStore) => Partial<SubagentsStore>),
  replace?: false,
  action?: string,
) => void;

type Get = () => SubagentsStore;

export function createSubagentsActions(set: Set, _get: Get): SubagentsActions {
  return {
    add: (node) => {
      set(
        (state) => ({
          nodes: { ...state.nodes, [node.runId]: node },
        }),
        false,
        "subagents/add",
      );
    },

    resolveSpawn: (tempKey: string, realRunId: string, sessionKey: string) => {
      set(
        (state) => {
          const existing = state.nodes[tempKey];
          if (!existing) return state;
          const { [tempKey]: _, ...rest } = state.nodes;
          return {
            nodes: {
              ...rest,
              [realRunId]: {
                ...existing,
                runId: realRunId,
                sessionKey,
                status: "running",
                toolCallId: existing.toolCallId || tempKey,
              },
            },
          };
        },
        false,
        "subagents/resolveSpawn",
      );
    },

    updateStatus: (runId: string, status: SubagentStatus, error?: string) => {
      set(
        (state) => {
          const existing = state.nodes[runId];
          if (!existing) return state;
          return {
            nodes: {
              ...state.nodes,
              [runId]: {
                ...existing,
                status,
                ...(error != null && { error }),
                ...(isTerminal(status) && { endedAt: Date.now() }),
              },
            },
          };
        },
        false,
        "subagents/updateStatus",
      );
    },

    setHistory: (runId, messages) => {
      set(
        (state) => {
          if (hasSameHistory(state.historyByRunId[runId], messages)) return state;
          return { historyByRunId: { ...state.historyByRunId, [runId]: messages } };
        },
        false,
        "subagents/setHistory",
      );
    },

    remove: (runId) => {
      set(
        (state) => {
          const { [runId]: _, ...rest } = state.nodes;
          const { [runId]: __, ...histRest } = state.historyByRunId;
          return {
            nodes: rest,
            historyByRunId: histRest,
          };
        },
        false,
        "subagents/remove",
      );
    },

    reset: () => {
      set(initialState, false, "subagents/reset");
    },
  };
}

function isTerminal(status: SubagentStatus): boolean {
  return status === "done" || status === "error" || status === "timeout";
}

function hasSameHistory(
  prev: SubagentsStore["historyByRunId"][string] | undefined,
  next: SubagentsStore["historyByRunId"][string],
): boolean {
  if (prev === next) return true;
  if (!prev || prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    if (
      prev[i].role !== next[i].role ||
      prev[i].content !== next[i].content ||
      prev[i].timestampMs !== next[i].timestampMs
    ) {
      return false;
    }
  }

  return true;
}
