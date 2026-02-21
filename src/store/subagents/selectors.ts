import type { SubagentHistoryMessage, SubagentNode, SubagentsStore } from "./types";

export const selectNodes = (state: SubagentsStore) => state.nodes;

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

export function selectNodeByToolCallId(
  state: SubagentsStore,
  toolCallId: string,
): SubagentNode | null {
  for (const node of Object.values(state.nodes)) {
    if (node.toolCallId === toolCallId) return node;
  }
  return null;
}

export function selectHistory(state: SubagentsStore, runId: string | null) {
  if (!runId) return EMPTY_HISTORY;
  return state.historyByRunId[runId] ?? EMPTY_HISTORY;
}
