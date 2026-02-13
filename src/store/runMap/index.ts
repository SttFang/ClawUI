import type {
  ApprovalNode,
  RunNode,
  RunNodeType,
  RunSource,
  RunStatus,
  SessionRunMap,
  TimelineEvent,
  ToolCallNode,
} from "@clawui/types/run-map";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";

const MAX_TIMELINE_EVENTS = 300;

type RunMapState = {
  sessions: Record<string, SessionRunMap>;
};

type RunMapActions = {
  ingestNormalizedEvent: (event: ChatNormalizedRunEvent) => void;
  ingestGatewayFrame: (frame: GatewayEventFrame) => void;
  clearSession: (sessionKey: string) => void;
  resetAll: () => void;
};

type RunMapStore = RunMapState & RunMapActions;

function normalizeSessionKey(sessionKey: string | null | undefined): string {
  return typeof sessionKey === "string" ? sessionKey.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveToolCallId(record: Record<string, unknown> | null): string {
  if (!record) return "";
  const candidates = [
    record.toolCallId,
    record.tool_call_id,
    record.toolUseId,
    record.tool_use_id,
    record.id,
    record.toolId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

function createEmptySession(): SessionRunMap {
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

function cloneSession(session: SessionRunMap): SessionRunMap {
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

function inferStatusFromKind(event: ChatNormalizedRunEvent): RunStatus {
  if (event.status) return event.status;
  switch (event.kind) {
    case "run.waiting_approval":
      return "waiting_approval";
    case "run.completed":
      return "completed";
    case "run.failed":
      return "failed";
    case "run.aborted":
      return "aborted";
    case "run.started":
      return "started";
    default:
      return "running";
  }
}

function inferStatusFromChatState(state: string): RunStatus {
  if (state === "final") return "completed";
  if (state === "error") return "failed";
  if (state === "aborted") return "aborted";
  return "running";
}

function inferRunType(event: ChatNormalizedRunEvent): RunNodeType {
  if (event.kind === "run.waiting_approval" || event.kind === "run.approval_resolved") {
    return "approval";
  }
  if (
    event.kind === "run.tool_started" ||
    event.kind === "run.tool_updated" ||
    event.kind === "run.tool_finished"
  ) {
    return "agent";
  }
  return "chat";
}

function isTerminalStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "aborted";
}

function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const list = map[key] ?? [];
  if (!list.includes(value)) {
    map[key] = [...list, value];
  }
}

function appendTimeline(session: SessionRunMap, event: TimelineEvent): void {
  session.timeline.push(event);
  if (session.timeline.length > MAX_TIMELINE_EVENTS) {
    session.timeline = session.timeline.slice(-MAX_TIMELINE_EVENTS);
  }
}

function resolveRelatedRunIdForApproval(session: SessionRunMap): string | undefined {
  if (session.rootChatRunId && session.runsById[session.rootChatRunId]) {
    return session.rootChatRunId;
  }
  const latest = Object.values(session.runsById)
    .filter((run) => run.type === "chat")
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
  return latest?.runId;
}

function resolveCanonicalRunId(session: SessionRunMap, candidateRunId: string): string {
  const rid = candidateRunId.trim();
  if (!rid) return "";
  return (
    session.indexes.runIdByClientRunId[rid] ??
    session.indexes.runIdByAgentRunId[rid] ??
    session.runsById[rid]?.runId ??
    rid
  );
}

function ensureRunNode(params: {
  session: SessionRunMap;
  sessionKey: string;
  runId: string;
  type: RunNodeType;
  source: RunSource;
  status: RunStatus;
  parentRunId?: string;
  clientRunId?: string;
  agentRunId?: string;
  atMs: number;
}): RunNode {
  const existing = params.session.runsById[params.runId];
  const next: RunNode = existing
    ? {
        ...existing,
        type: existing.type === "chat" ? "chat" : params.type,
        status: isTerminalStatus(existing.status) ? existing.status : params.status,
        source: existing.source === "chat.send" ? existing.source : params.source,
        parentRunId: existing.parentRunId ?? params.parentRunId,
        clientRunId: existing.clientRunId ?? params.clientRunId,
        agentRunId: existing.agentRunId ?? params.agentRunId,
        updatedAtMs: params.atMs,
      }
    : {
        runId: params.runId,
        sessionKey: params.sessionKey,
        type: params.type,
        source: params.source,
        status: params.status,
        parentRunId: params.parentRunId,
        clientRunId: params.clientRunId,
        agentRunId: params.agentRunId,
        startedAtMs: params.atMs,
        updatedAtMs: params.atMs,
      };

  if (isTerminalStatus(next.status) && !next.endedAtMs) {
    next.endedAtMs = params.atMs;
  }

  params.session.runsById[next.runId] = next;
  if (next.clientRunId) {
    params.session.indexes.runIdByClientRunId[next.clientRunId] = next.runId;
  }
  if (next.agentRunId) {
    params.session.indexes.runIdByAgentRunId[next.agentRunId] = next.runId;
  }
  return next;
}

function upsertApproval(params: {
  session: SessionRunMap;
  approvalId: string;
  sessionKey: string;
  status: ApprovalNode["status"];
  relatedRunId?: string;
  command?: string;
  decision?: ApprovalNode["decision"];
  atMs: number;
}): ApprovalNode {
  const existing = params.session.approvalsById[params.approvalId];
  const next: ApprovalNode = existing
    ? {
        ...existing,
        status: params.status,
        relatedRunId: existing.relatedRunId ?? params.relatedRunId,
        command: existing.command ?? params.command,
        decision: params.decision ?? existing.decision,
        resolvedAtMs: params.status === "resolved" ? params.atMs : existing.resolvedAtMs,
      }
    : {
        approvalId: params.approvalId,
        sessionKey: params.sessionKey,
        relatedRunId: params.relatedRunId,
        status: params.status,
        command: params.command,
        decision: params.decision,
        createdAtMs: params.atMs,
        resolvedAtMs: params.status === "resolved" ? params.atMs : undefined,
      };
  params.session.approvalsById[params.approvalId] = next;
  return next;
}

function upsertToolCall(params: {
  session: SessionRunMap;
  toolCallId: string;
  sessionKey: string;
  runId: string;
  toolName: string;
  phase: ToolCallNode["phase"];
  atMs: number;
}): ToolCallNode {
  const existing = params.session.toolCallsById[params.toolCallId];
  const status: ToolCallNode["status"] =
    params.phase === "error"
      ? "error"
      : params.phase === "result" || params.phase === "end"
        ? "completed"
        : "running";
  const next: ToolCallNode = existing
    ? {
        ...existing,
        runId: params.runId,
        toolName: params.toolName || existing.toolName,
        phase: params.phase,
        status,
        updatedAtMs: params.atMs,
      }
    : {
        toolCallId: params.toolCallId,
        sessionKey: params.sessionKey,
        runId: params.runId,
        toolName: params.toolName,
        phase: params.phase,
        status,
        createdAtMs: params.atMs,
        updatedAtMs: params.atMs,
      };
  params.session.toolCallsById[params.toolCallId] = next;
  pushUnique(params.session.indexes.toolCallIdsByRunId, params.runId, params.toolCallId);
  return next;
}

function findSessionKeyByApprovalId(
  sessions: Record<string, SessionRunMap>,
  approvalId: string,
): string {
  const targetId = approvalId.trim();
  if (!targetId) return "";
  for (const [sessionKey, session] of Object.entries(sessions)) {
    if (session.approvalsById[targetId]) {
      return sessionKey;
    }
  }
  return "";
}

export const useRunMapStore = create<RunMapStore>()(
  devtools(
    (set) => ({
      sessions: {},

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
              const atMs =
                typeof payload.createdAtMs === "number" ? payload.createdAtMs : Date.now();
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
    }),
    { name: "RunMapStore" },
  ),
);

let runMapListenerInitialized = false;

export function initRunMapListener() {
  if (runMapListenerInitialized || typeof window === "undefined") return;
  runMapListenerInitialized = true;

  ipc.chat.onNormalizedEvent((event) => {
    useRunMapStore.getState().ingestNormalizedEvent(event);
  });

  ipc.gateway.onEvent((frame) => {
    useRunMapStore.getState().ingestGatewayFrame(frame);
  });
}
