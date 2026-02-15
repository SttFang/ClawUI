import { type ConfigState, initialConfigState } from "./slices/config/initialState";
import { type CronState, initialCronState } from "./slices/cron/initialState";
import { type CrudState, initialCrudState } from "./slices/crud/initialState";
import { type NodesState, initialNodesState } from "./slices/nodes/initialState";

export type AgentsStoreState = CrudState & ConfigState & CronState & NodesState;

export const initialState: AgentsStoreState = {
  ...initialCrudState,
  ...initialConfigState,
  ...initialCronState,
  ...initialNodesState,
};
