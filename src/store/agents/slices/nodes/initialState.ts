import type { NodeInfo, PendingNode } from "../../types";

export interface NodesState {
  nodes: NodeInfo[];
  pendingNodes: PendingNode[];
  nodesError: string | null;
  nodesLoading: boolean;
}

export const initialNodesState: NodesState = {
  nodes: [],
  pendingNodes: [],
  nodesError: null,
  nodesLoading: false,
};
