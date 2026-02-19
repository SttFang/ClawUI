import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { SubagentsStore } from "./types";
import { createSubagentsActions } from "./actions";
import { initialState } from "./initialState";

export const useSubagentsStore = create<SubagentsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      ...createSubagentsActions(set, get),
    }),
    { name: "SubagentsStore" },
  ),
);
