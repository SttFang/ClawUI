import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { RunMapStore } from "./types";
import { createRunMapActions } from "./actions";
import { initialState } from "./initialState";

export const useRunMapStore = create<RunMapStore>()(
  devtools(
    (set) => ({
      ...initialState,
      ...createRunMapActions(set),
    }),
    { name: "RunMapStore" },
  ),
);
