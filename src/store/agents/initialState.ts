import { type ConfigState, initialConfigState } from "./slices/config/initialState";
import { type CronState, initialCronState } from "./slices/cron/initialState";
import { type CrudState, initialCrudState } from "./slices/crud/initialState";

export type AgentsStoreState = CrudState & ConfigState & CronState;

export const initialState: AgentsStoreState = {
  ...initialCrudState,
  ...initialConfigState,
  ...initialCronState,
};
