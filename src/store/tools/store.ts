import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ToolsStore } from "./types";
import { createToolsActions } from "./actions";
import { initialState } from "./initialState";

export const useToolsStore = create<ToolsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      ...createToolsActions(set, get),
    }),
    { name: "ToolsStore" },
  ),
);
