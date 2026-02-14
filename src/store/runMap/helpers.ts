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
import type { ChatNormalizedRunEvent } from "@/lib/ipc";
import { MAX_TIMELINE_EVENTS } from "./initialState";

export function normalizeSessionKey(sessionKey: string | null | undefined): string {
  return typeof sessionKey === "string" ? sessionKey.trim() : "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveToolCallId(record: Record<string, unknown> | null): string {
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

export function inferStatusFromKind(event: ChatNormalizedRunEvent): RunStatus {
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

export function inferStatusFromChatState(state: string): RunStatus {
  if (state === "final") return "completed";
  if (state === "error") return "failed";
  if (state === "aborted") return "aborted";
  return "running";
}

export function inferRunType(event: ChatNormalizedRunEvent): RunNodeType {
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

export function isTerminalStatus(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "aborted";
}

export function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const list = map[key] ?? [];
  if (!list.includes(value)) {
    map[key] = [...list, value];
  }
}

export function appendTimeline(session: SessionRunMap, event: TimelineEvent): void {
  session.timeline.push(event);
  if (session.timeline.length > MAX_TIMELINE_EVENTS) {
    session.timeline = session.timeline.slice(-MAX_TIMELINE_EVENTS);
  }
}

export function resolveRelatedRunIdForApproval(session: SessionRunMap): string | undefined {
  if (session.rootChatRunId && session.runsById[session.rootChatRunId]) {
    return session.rootChatRunId;
  }
  const latest = Object.values(session.runsById)
    .filter((run) => run.type === "chat")
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
  return latest?.runId;
}

export function resolveCanonicalRunId(session: SessionRunMap, candidateRunId: string): string {
  const rid = candidateRunId.trim();
  if (!rid) return "";
  return (
    session.indexes.runIdByClientRunId[rid] ??
    session.indexes.runIdByAgentRunId[rid] ??
    session.runsById[rid]?.runId ??
    rid
  );
}

export function ensureRunNode(params: {
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

export function upsertApproval(params: {
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

export function upsertToolCall(params: {
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

export function findSessionKeyByApprovalId(
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
