import type { SessionRunMap } from "@clawui/types/run-map";
import type { RunMapStore } from "./types";

export const selectRunMapSessions = (state: RunMapStore) => state.sessions;

export const selectSessionRunMap =
  (sessionKey: string) =>
  (state: RunMapStore): SessionRunMap | undefined =>
    state.sessions[sessionKey];

export const runMapSelectors = {
  selectRunMapSessions,
  selectSessionRunMap,
};
