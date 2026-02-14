import type { DynamicToolUIPart } from "ai";
import type { ExecLifecycleRecord, ExecLifecycleStatus } from "./types";

export const EXEC_LIFECYCLE_STATUS_PRIORITY: Record<ExecLifecycleStatus, number> = {
  pending_approval: 1,
  running: 2,
  completed: 3,
  denied: 3,
  timeout: 3,
  error: 3,
};

type ProjectExecLifecycleInput = {
  part: DynamicToolUIPart;
  sessionKey: string;
  messageId: string;
  partIndex: number;
  now: number;
  approvalRequested: boolean;
  approvalId?: string;
  runningMarked: boolean;
  runId?: string;
  attemptId?: string;
  gatewayId?: string;
  requestId?: string;
  decision?: "allow-once" | "allow-always" | "deny" | "timeout";
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isExecPreliminary(part: DynamicToolUIPart): boolean {
  const marker = (part as unknown as { preliminary?: unknown }).preliminary;
  return marker === true;
}

function getCwdFromInput(input: unknown): string | undefined {
  const record = toRecord(input);
  if (!record) return undefined;
  const cwd = record.cwd;
  if (typeof cwd !== "string") return undefined;
  const normalized = cwd.trim();
  return normalized || undefined;
}

function getYieldMsFromInput(input: unknown): number | undefined {
  const record = toRecord(input);
  if (!record) return undefined;
  const yieldMs = record.yieldMs;
  return typeof yieldMs === "number" ? yieldMs : undefined;
}

export function normalizeCommand(value: string): string {
  return normalizeWhitespace(value);
}

export function normalizeSessionKey(value: string): string {
  return value.trim();
}

export function getCommandFromInput(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const command = record.command;
  return typeof command === "string" ? command.trim() : "";
}

export function extractRunIdFromToolCallId(toolCallId: string): string {
  const normalized = toolCallId.trim();
  if (!normalized) return "";
  const base = normalized.includes("|") ? normalized.split("|")[0] : normalized;
  const markerIndex = base.indexOf(":tool");
  if (markerIndex > 0) return base.slice(0, markerIndex);
  return base;
}

export function buildSessionCommandKey(sessionKey: string, command: string): string {
  return `${normalizeSessionKey(sessionKey)}::${normalizeCommand(command)}`;
}

export function buildFallbackAttemptId(input: {
  runId?: string;
  sessionKey: string;
  command: string;
  toolCallId: string;
}): string {
  const runSegment =
    input.runId?.trim() || extractRunIdFromToolCallId(input.toolCallId) || "run:unknown";
  const normalizedCommand = normalizeCommand(input.command);
  if (!normalizedCommand) {
    return `attempt:${runSegment}::${normalizeSessionKey(input.sessionKey)}::<no-command>::${input.toolCallId}`;
  }
  return `attempt:${runSegment}::${normalizeSessionKey(input.sessionKey)}::${normalizedCommand}::${input.toolCallId}`;
}

export function buildExecLifecycleKey(input: {
  attemptId: string;
  runId?: string;
  sessionKey: string;
  command: string;
  toolCallId: string;
}): string {
  const attemptId = input.attemptId.trim();
  if (attemptId) return attemptId;
  return buildFallbackAttemptId({
    runId: input.runId,
    sessionKey: input.sessionKey,
    command: input.command,
    toolCallId: input.toolCallId,
  });
}

export function deriveExecLifecycleStatus(input: {
  partState: DynamicToolUIPart["state"];
  preliminary: boolean;
  approvalRequested: boolean;
  runningMarked: boolean;
  decision?: "allow-once" | "allow-always" | "deny" | "timeout";
}): ExecLifecycleStatus {
  if (input.decision === "timeout") return "timeout";
  if (input.decision === "deny") return "denied";
  if (input.partState === "output-error") return "error";
  if (input.partState === "output-available" && !input.preliminary) return "completed";
  if (input.approvalRequested) return "pending_approval";
  if (
    input.runningMarked ||
    input.partState === "input-streaming" ||
    (input.partState === "output-available" && input.preliminary)
  ) {
    return "running";
  }
  return "pending_approval";
}

export function isTerminalExecLifecycleStatus(status: ExecLifecycleStatus): boolean {
  return (
    status === "completed" || status === "denied" || status === "timeout" || status === "error"
  );
}

export function projectExecLifecycleRecord(input: ProjectExecLifecycleInput): ExecLifecycleRecord {
  const command = getCommandFromInput(input.part.input);
  const normalizedCommand = normalizeCommand(command);
  const runId =
    input.runId?.trim() || extractRunIdFromToolCallId(input.part.toolCallId) || "run:unknown";
  const attemptId =
    input.attemptId?.trim() ||
    (input.approvalId?.trim() ? `approval:${input.approvalId.trim()}` : "") ||
    buildFallbackAttemptId({
      runId,
      sessionKey: input.sessionKey,
      command,
      toolCallId: input.part.toolCallId,
    });
  const lifecycleKey = buildExecLifecycleKey({
    attemptId,
    runId,
    sessionKey: input.sessionKey,
    command,
    toolCallId: input.part.toolCallId,
  });
  const preliminary = isExecPreliminary(input.part);
  const status = deriveExecLifecycleStatus({
    partState: input.part.state,
    preliminary,
    approvalRequested: input.approvalRequested,
    runningMarked: input.runningMarked,
    decision: input.decision,
  });
  const endedAtMs = isTerminalExecLifecycleStatus(status) ? input.now : undefined;

  return {
    attemptId,
    lifecycleKey,
    runId,
    sessionKey: normalizeSessionKey(input.sessionKey),
    command,
    normalizedCommand,
    status,
    gatewayId: input.gatewayId,
    requestId: input.requestId,
    decision: input.decision,
    toolCallId: input.part.toolCallId,
    toolName: input.part.toolName,
    messageId: input.messageId,
    partIndex: input.partIndex,
    partState: input.part.state,
    preliminary,
    startedAtMs: input.now,
    updatedAtMs: input.now,
    endedAtMs,
    approvalId: input.approvalId,
    cwd: getCwdFromInput(input.part.input),
    yieldMs: getYieldMsFromInput(input.part.input),
    errorText: input.part.errorText,
    sourceToolCallIds: [input.part.toolCallId],
  };
}

export function mergeExecLifecycleRecord(
  current: ExecLifecycleRecord,
  incoming: ExecLifecycleRecord,
): ExecLifecycleRecord {
  const currentRank = EXEC_LIFECYCLE_STATUS_PRIORITY[current.status];
  const incomingRank = EXEC_LIFECYCLE_STATUS_PRIORITY[incoming.status];
  const preferIncoming =
    incomingRank > currentRank ||
    (incomingRank === currentRank && incoming.updatedAtMs >= current.updatedAtMs);
  const dominant = preferIncoming ? incoming : current;

  const sourceToolCallIds = Array.from(
    new Set([...current.sourceToolCallIds, ...incoming.sourceToolCallIds]),
  );

  return {
    ...current,
    ...incoming,
    attemptId: current.attemptId || incoming.attemptId,
    lifecycleKey: current.lifecycleKey || incoming.lifecycleKey,
    runId: current.runId === "run:unknown" ? incoming.runId : current.runId,
    command: incoming.command || current.command,
    normalizedCommand: incoming.normalizedCommand || current.normalizedCommand,
    status: dominant.status,
    gatewayId: incoming.gatewayId ?? current.gatewayId,
    requestId: incoming.requestId ?? current.requestId,
    decision: incoming.decision ?? current.decision,
    partState: dominant.partState,
    preliminary: dominant.preliminary,
    approvalId: incoming.approvalId ?? current.approvalId,
    cwd: incoming.cwd ?? current.cwd,
    yieldMs: incoming.yieldMs ?? current.yieldMs,
    errorText: incoming.errorText ?? current.errorText,
    startedAtMs: Math.min(current.startedAtMs, incoming.startedAtMs),
    updatedAtMs: Math.max(current.updatedAtMs, incoming.updatedAtMs),
    endedAtMs: dominant.endedAtMs ?? current.endedAtMs,
    messageId: preferIncoming ? incoming.messageId : current.messageId,
    partIndex: preferIncoming ? incoming.partIndex : current.partIndex,
    sourceToolCallIds,
  };
}
