import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AgentsStoreState } from "./initialState";
import { initialState } from "./initialState";
import { type ConfigAction, configSlice } from "./slices/config/action";
import { type CronAction, cronSlice } from "./slices/cron/action";
import { type CrudAction, crudSlice } from "./slices/crud/action";
import { type NodesAction, nodesSlice } from "./slices/nodes/action";

export type AgentsStore = AgentsStoreState & CrudAction & ConfigAction & CronAction & NodesAction;

export const useAgentsStore = create<AgentsStore>()(
  devtools(
    (...a) => ({
      ...initialState,
      ...crudSlice(...a),
      ...configSlice(...a),
      ...cronSlice(...a),
      ...nodesSlice(...a),
    }),
    { name: "AgentsStore" },
  ),
);
