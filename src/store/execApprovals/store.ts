import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ExecApprovalsStore } from "./types";
import { createExecApprovalsActions } from "./actions";
import { initialState } from "./initialState";

export const useExecApprovalsStore = create<ExecApprovalsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      ...createExecApprovalsActions(set, get),
    }),
    { name: "ExecApprovalsStore" },
  ),
);
