import type { ToolCallNode } from "@clawui/types/run-map";
import type { RunMapStore } from "./types";
import {
  appendTimeline,
  ensureRunNode,
  findSessionKeyByApprovalId,
  inferRunType,
  inferStatusFromChatState,
  inferStatusFromKind,
  isRecord,
  isTerminalStatus,
  normalizeSessionKey,
  pushUnique,
  resolveCanonicalRunId,
  resolveRelatedRunIdForApproval,
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

          if (frame.event === "exec.approval.requested" && isRecord(frame.payload)) {
            const payload = frame.payload;
            const id = typeof payload.id === "string" ? payload.id.trim() : "";
            const request = isRecord(payload.request) ? payload.request : null;
            const sessionKey = normalizeSessionKey(
              typeof request?.sessionKey === "string" ? request.sessionKey : "",
            );
            const command = typeof request?.command === "string" ? request.command.trim() : "";
            if (!id || !sessionKey) return state;

            const baseSession = state.sessions[sessionKey] ?? createEmptySession();
            const session = cloneSession(baseSession);
            const atMs = typeof payload.createdAtMs === "number" ? payload.createdAtMs : Date.now();
            const relatedRunId = resolveRelatedRunIdForApproval(session);
            const approval = upsertApproval({
              session,
              approvalId: id,
              sessionKey,
              status: "pending",
              relatedRunId,
              command,
              atMs,
            });
            ensureRunNode({
              session,
              sessionKey,
              runId: id,
              type: "approval",
              source: "approval.event",
              status: "waiting_approval",
              parentRunId: relatedRunId,
              atMs,
            });
            if (relatedRunId) {
              pushUnique(session.indexes.approvalIdsByRunId, relatedRunId, approval.approvalId);
            }
            appendTimeline(session, {
              id: `approval.requested:${id}:${atMs}`,
              sessionKey,
              atMs,
              kind: "approval.requested",
              runId: relatedRunId,
              approvalId: id,
              payload: { command: command || null },
            });
            return { sessions: { ...state.sessions, [sessionKey]: session } };
          }

          if (frame.event === "exec.approval.resolved" && isRecord(frame.payload)) {
            const payload = frame.payload;
            const id = typeof payload.id === "string" ? payload.id.trim() : "";
            const decision =
              payload.decision === "allow-once" ||
              payload.decision === "allow-always" ||
              payload.decision === "deny"
                ? payload.decision
                : undefined;
            if (!id) return state;
            const foundSessionKey = findSessionKeyByApprovalId(state.sessions, id);
            if (!foundSessionKey) return state;
            const baseSession = state.sessions[foundSessionKey];
            if (!baseSession) return state;
            const session = cloneSession(baseSession);
            const atMs = typeof payload.ts === "number" ? payload.ts : Date.now();
            const approval = upsertApproval({
              session,
              approvalId: id,
              sessionKey: foundSessionKey,
              status: "resolved",
              decision,
              atMs,
            });
            ensureRunNode({
              session,
              sessionKey: foundSessionKey,
              runId: id,
              type: "approval",
              source: "approval.event",
              status: decision === "deny" ? "aborted" : "running",
              parentRunId: approval.relatedRunId,
              atMs,
            });
            appendTimeline(session, {
              id: `approval.resolved:${id}:${atMs}`,
              sessionKey: foundSessionKey,
              atMs,
              kind: "approval.resolved",
              runId: approval.relatedRunId,
              approvalId: id,
              payload: { decision: decision ?? null },
            });
            return { sessions: { ...state.sessions, [foundSessionKey]: session } };
          }

          if (frame.event === "agent" && isRecord(frame.payload)) {
            const payload = frame.payload;
            const sessionKey = normalizeSessionKey(
              typeof payload.sessionKey === "string" ? payload.sessionKey : "",
            );
            const runIdRaw = typeof payload.runId === "string" ? payload.runId.trim() : "";
            if (!sessionKey || !runIdRaw) return state;
            const baseSession = state.sessions[sessionKey] ?? createEmptySession();
            const session = cloneSession(baseSession);
            const atMs = typeof payload.ts === "number" ? payload.ts : Date.now();
            const runId = resolveCanonicalRunId(session, runIdRaw);
            const stream = typeof payload.stream === "string" ? payload.stream : "";
            const data = isRecord(payload.data) ? payload.data : null;

            const run = ensureRunNode({
              session,
              sessionKey,
              runId,
              type: runId === runIdRaw ? "agent" : "chat",
              source: runId === runIdRaw ? "fallback" : "agent.event",
              status: "running",
              agentRunId: runIdRaw,
              atMs,
            });

            if (stream === "tool" && data) {
              const toolCallId = resolveToolCallId(data);
              const toolName = typeof data.name === "string" ? data.name.trim() : "tool";
              const phase = typeof data.phase === "string" ? data.phase : "update";
              if (toolCallId) {
                upsertToolCall({
                  session,
                  toolCallId,
                  sessionKey,
                  runId: run.runId,
                  toolName,
                  phase:
                    phase === "start" ||
                    phase === "update" ||
                    phase === "result" ||
                    phase === "error" ||
                    phase === "end"
                      ? phase
                      : "update",
                  atMs,
                });
                appendTimeline(session, {
                  id: `tool:${toolCallId}:${phase}:${atMs}`,
                  sessionKey,
                  atMs,
                  kind: `tool.${phase}`,
                  runId: run.runId,
                  toolCallId,
                  payload: { toolName },
                });
              }
            } else if (stream === "lifecycle" && data) {
              const phase = typeof data.phase === "string" ? data.phase : "";
              if (phase === "end") run.status = "completed";
              if (phase === "error") run.status = "failed";
              if (isTerminalStatus(run.status) && !run.endedAtMs) run.endedAtMs = atMs;
              appendTimeline(session, {
                id: `lifecycle:${runIdRaw}:${phase}:${atMs}`,
                sessionKey,
                atMs,
                kind: `lifecycle.${phase || "unknown"}`,
                runId: run.runId,
              });
            } else if (stream === "compaction" && data) {
              const phase = typeof data.phase === "string" ? data.phase : "";
              appendTimeline(session, {
                id: `compaction:${runIdRaw}:${phase}:${atMs}`,
                sessionKey,
                atMs,
                kind: `compaction.${phase || "unknown"}`,
                runId: run.runId,
                payload: { willRetry: data.willRetry },
              });
            }

            return { sessions: { ...state.sessions, [sessionKey]: session } };
          }

          if (frame.event === "chat" && isRecord(frame.payload)) {
            const payload = frame.payload;
            const sessionKey = normalizeSessionKey(
              typeof payload.sessionKey === "string" ? payload.sessionKey : "",
            );
            const runIdRaw = typeof payload.runId === "string" ? payload.runId.trim() : "";
            const stateText = typeof payload.state === "string" ? payload.state : "";
            if (!sessionKey || !runIdRaw || !stateText) return state;
            const baseSession = state.sessions[sessionKey] ?? createEmptySession();
            const session = cloneSession(baseSession);
            const atMs = Date.now();
            const runId = resolveCanonicalRunId(session, runIdRaw);
            const run = ensureRunNode({
              session,
              sessionKey,
              runId,
              type: "chat",
              source: "agent.event",
              status: inferStatusFromChatState(stateText),
              clientRunId: runId,
              atMs,
            });
            if (!session.rootChatRunId) {
              session.rootChatRunId = run.runId;
            }
            appendTimeline(session, {
              id: `chat.${stateText}:${runIdRaw}:${atMs}`,
              sessionKey,
              atMs,
              kind: `chat.${stateText}`,
              runId: run.runId,
            });
            return { sessions: { ...state.sessions, [sessionKey]: session } };
          }

          return state;
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
