import type { ExecApprovalsState } from "./types";

export const initialState: ExecApprovalsState = {
  queue: [],
  busyById: {},
  runningByKey: {},
  lastResolvedBySession: {},
};
