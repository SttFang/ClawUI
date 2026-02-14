import type { SessionRunMap } from "@clawui/types/run-map";
import type { RunMapState } from "./types";

export const MAX_TIMELINE_EVENTS = 300;

export const initialState: RunMapState = {
  sessions: {},
};

export function createEmptySession(): SessionRunMap {
  return {
    runsById: {},
    approvalsById: {},
    toolCallsById: {},
    timeline: [],
    indexes: {
      runIdByAgentRunId: {},
      runIdByClientRunId: {},
      approvalIdsByRunId: {},
      toolCallIdsByRunId: {},
    },
  };
}

export function cloneSession(session: SessionRunMap): SessionRunMap {
  return {
    ...session,
    runsById: { ...session.runsById },
    approvalsById: { ...session.approvalsById },
    toolCallsById: { ...session.toolCallsById },
    timeline: [...session.timeline],
    indexes: {
      runIdByAgentRunId: { ...session.indexes.runIdByAgentRunId },
      runIdByClientRunId: { ...session.indexes.runIdByClientRunId },
      approvalIdsByRunId: Object.fromEntries(
        Object.entries(session.indexes.approvalIdsByRunId).map(([runId, ids]) => [runId, [...ids]]),
      ),
      toolCallIdsByRunId: Object.fromEntries(
        Object.entries(session.indexes.toolCallIdsByRunId).map(([runId, ids]) => [runId, [...ids]]),
      ),
    },
  };
}
