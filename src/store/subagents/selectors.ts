import type { SubagentHistoryMessage, SubagentNode, SubagentsStore } from "./types";

export const selectNodes = (state: SubagentsStore) => state.nodes;
export const selectPanelOpen = (state: SubagentsStore) => state.panelOpen;
export const selectSelectedRunId = (state: SubagentsStore) => state.selectedRunId;

const EMPTY_NODE_LIST: SubagentNode[] = [];
const EMPTY_HISTORY: SubagentHistoryMessage[] = [];

export function selectNodeList(state: SubagentsStore): SubagentNode[] {
  const values = Object.values(state.nodes);
  if (values.length === 0) return EMPTY_NODE_LIST;
  return values.sort((a, b) => a.createdAt - b.createdAt);
}

export function selectActiveCount(state: SubagentsStore): number {
  return Object.values(state.nodes).filter((n) => n.status === "spawning" || n.status === "running")
    .length;
}

export function selectAllDone(state: SubagentsStore): boolean {
  const nodes = Object.values(state.nodes);
  return (
    nodes.length > 0 &&
    nodes.every((n) => n.status === "done" || n.status === "error" || n.status === "timeout")
  );
}

export function selectSelectedNode(state: SubagentsStore): SubagentNode | null {
  if (!state.selectedRunId) return null;
  return state.nodes[state.selectedRunId] ?? null;
}

export function selectHistory(state: SubagentsStore, runId: string | null) {
  if (!runId) return EMPTY_HISTORY;
  return state.historyByRunId[runId] ?? EMPTY_HISTORY;
}
