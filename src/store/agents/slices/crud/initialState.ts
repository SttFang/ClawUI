import type { Agent } from "../../types";

export interface CrudState {
  agents: Agent[];
  selectedAgentId: string;
  loadingIds: string[];
}

export const initialCrudState: CrudState = {
  agents: [],
  selectedAgentId: "main",
  loadingIds: [],
};
