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
          panelOpen: true,
        }),
        false,
        "subagents/add",
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

    select: (runId) => {
      set({ selectedRunId: runId }, false, "subagents/select");
    },

    togglePanel: (open) => {
      set((state) => ({ panelOpen: open ?? !state.panelOpen }), false, "subagents/togglePanel");
    },

    setHistory: (runId, messages) => {
      set(
        (state) => ({
          historyByRunId: { ...state.historyByRunId, [runId]: messages },
        }),
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
            selectedRunId: state.selectedRunId === runId ? null : state.selectedRunId,
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
