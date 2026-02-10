import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AgentsStoreState } from "./initialState";
import { initialState } from "./initialState";
import { type ConfigAction, configSlice } from "./slices/config/action";
import { type CronAction, cronSlice } from "./slices/cron/action";
import { type CrudAction, crudSlice } from "./slices/crud/action";

export type AgentsStore = AgentsStoreState & CrudAction & ConfigAction & CronAction;

export const useAgentsStore = create<AgentsStore>()(
  devtools(
    (...a) => ({
      ...initialState,
      ...crudSlice(...a),
      ...configSlice(...a),
      ...cronSlice(...a),
    }),
    { name: "AgentsStore" },
  ),
);
