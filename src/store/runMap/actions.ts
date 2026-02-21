import type { ToolCallNode } from "@clawui/types/run-map";
import type { RunMapStore } from "./types";
import {
  handleAgentEvent,
  handleApprovalRequested,
  handleApprovalResolved,
  handleChatEvent,
} from "./handlers";
import {
  appendTimeline,
  ensureRunNode,
  inferRunType,
  inferStatusFromKind,
  isRecord,
  normalizeSessionKey,
  pushUnique,
  resolveToolCallId,
  upsertApproval,
  upsertToolCall,
} from "./helpers";
import { cloneSession, createEmptySession } from "./initialState";

export type RunMapSetFn = (
  fn: ((state: RunMapStore) => Partial<RunMapStore>) | Partial<RunMapStore>,
  replace?: false | undefined,
  name?: string,
) => void;

export function createRunMapActions(
  set: RunMapSetFn,
): Pick<RunMapStore, "ingestNormalizedEvent" | "ingestGatewayFrame" | "clearSession" | "resetAll"> {
  return {
    ingestNormalizedEvent: (event) =>
      set(
        (state) => {
          const sessionKey = normalizeSessionKey(event.sessionKey);
          const canonicalRunId = event.clientRunId?.trim();
          if (!sessionKey || !canonicalRunId) return state;
          const baseSession = state.sessions[sessionKey] ?? createEmptySession();
          const session = cloneSession(baseSession);
          const atMs = event.timestampMs || Date.now();

          const run = ensureRunNode({
            session,
            sessionKey,
            runId: canonicalRunId,
            type: inferRunType(event),
            source: event.source === "synthetic" ? "chat.send" : "agent.event",
            status: inferStatusFromKind(event),
            clientRunId: canonicalRunId,
            agentRunId: event.agentRunId?.trim() || undefined,
            atMs,
          });

          if (!session.rootChatRunId && (run.type === "chat" || event.kind === "run.started")) {
            session.rootChatRunId = run.runId;
          }

          appendTimeline(session, {
            id: `${event.traceId}:${event.kind}:${atMs}`,
            sessionKey,
            atMs,
            kind: event.kind,
            runId: run.runId,
            approvalId: event.approvalId,
            payload: {
              status: event.status ?? null,
              text: event.text ?? null,
              error: event.error ?? null,
            },
          });

          if (event.approvalId) {
            const approval = upsertApproval({
              session,
              approvalId: event.approvalId,
              sessionKey,
              status: event.kind === "run.approval_resolved" ? "resolved" : "pending",
              relatedRunId: run.runId,
              command: event.command,
              decision: event.decision,
              atMs,
            });
            pushUnique(session.indexes.approvalIdsByRunId, run.runId, approval.approvalId);
          }

          const meta = isRecord(event.metadata) ? event.metadata : null;
          const toolCallId = resolveToolCallId(meta);
          const toolName = typeof meta?.name === "string" ? meta.name.trim() : "";
          if (toolCallId) {
            const phase =
              event.kind === "run.tool_started"
                ? "start"
                : event.kind === "run.tool_updated"
                  ? "update"
                  : event.kind === "run.tool_finished"
                    ? ((meta?.phase as ToolCallNode["phase"]) ?? "result")
                    : "update";
            upsertToolCall({
              session,
              toolCallId,
              sessionKey,
              runId: run.runId,
              toolName: toolName || "tool",
              phase,
              atMs,
            });
          }

          return { sessions: { ...state.sessions, [sessionKey]: session } };
        },
        false,
        "runMap/ingestNormalizedEvent",
      ),

    ingestGatewayFrame: (frame) =>
      set(
        (state) => {
          if (!frame || frame.type !== "event") return state;
          if (!isRecord(frame.payload)) return state;

          switch (frame.event) {
            case "exec.approval.requested":
              return handleApprovalRequested(state, frame);
            case "exec.approval.resolved":
              return handleApprovalResolved(state, frame);
            case "agent":
              return handleAgentEvent(state, frame);
            case "chat":
              return handleChatEvent(state, frame);
            default:
              return state;
          }
        },
        false,
        "runMap/ingestGatewayFrame",
      ),

    clearSession: (sessionKey) =>
      set(
        (state) => {
          const normalized = normalizeSessionKey(sessionKey);
          if (!normalized || !state.sessions[normalized]) return state;
          const next = { ...state.sessions };
          delete next[normalized];
          return { sessions: next };
        },
        false,
        "runMap/clearSession",
      ),

    resetAll: () => set({ sessions: {} }, false, "runMap/resetAll"),
  };
}
