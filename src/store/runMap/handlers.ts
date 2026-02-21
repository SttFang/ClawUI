import type { RunMapStore } from "./types";
import {
  appendTimeline,
  ensureRunNode,
  findSessionKeyByApprovalId,
  inferStatusFromChatState,
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

interface GatewayFrame {
  type: string;
  event: string;
  payload?: unknown;
}

type Sessions = RunMapStore["sessions"];

export function handleApprovalRequested(
  state: RunMapStore,
  frame: GatewayFrame,
): { sessions: Sessions } | typeof state {
  const payload = frame.payload as Record<string, unknown>;
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

export function handleApprovalResolved(
  state: RunMapStore,
  frame: GatewayFrame,
): { sessions: Sessions } | typeof state {
  const payload = frame.payload as Record<string, unknown>;
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

export function handleAgentEvent(
  state: RunMapStore,
  frame: GatewayFrame,
): { sessions: Sessions } | typeof state {
  const payload = frame.payload as Record<string, unknown>;
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

export function handleChatEvent(
  state: RunMapStore,
  frame: GatewayFrame,
): { sessions: Sessions } | typeof state {
  const payload = frame.payload as Record<string, unknown>;
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
