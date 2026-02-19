import type { SubagentsState } from "./types";

export const initialState: SubagentsState = {
  nodes: {},
  selectedRunId: null,
  panelOpen: false,
  historyByRunId: {},
};
