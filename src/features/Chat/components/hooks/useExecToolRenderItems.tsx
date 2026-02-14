import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { ExecActionItem } from "@/components/A2UI";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import {
  buildFallbackAttemptId,
  buildSessionCommandKey,
  extractRunIdFromToolCallId,
  isTerminalExecLifecycleStatus,
  mergeExecLifecycleRecord,
  projectExecLifecycleRecord,
  useExecLifecycleStore,
  type ExecLifecycleRecord,
  type ExecLifecycleStatus,
} from "@/store/execLifecycle";

type UseExecToolRenderItemsInput = {
  message: UIMessage;
  sessionKey: string;
};

type UseExecToolRenderItem = {
  attemptId: string;
  node: ReactElement;
};

type UseExecToolRenderItemsResult = Record<number, UseExecToolRenderItem>;

type ParsedSystemTerminal = {
  status: ExecLifecycleStatus;
  gatewayId?: string;
  approvalId?: string;
  command?: string;
  atMs: number;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readCommandFromInput(input: unknown): string {
  const record = toRecord(input);
  if (!record) return "";
  const command = record.command;
  return typeof command === "string" ? command.trim() : "";
}

function isExecToolName(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  return normalized === "exec" || normalized === "bash";
}

function parseToolCallTimestamp(toolCallId: string): number {
  const assistantMatch = toolCallId.match(/assistant:(\d{10,})/);
  if (assistantMatch) {
    const parsed = Number.parseInt(assistantMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const genericMatch = toolCallId.match(/:(\d{10,})(?::|$)/);
  if (genericMatch) {
    const parsed = Number.parseInt(genericMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function parseSystemTs(text: string): number {
  const match = text.match(/\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+GMT([+-]\d{1,2})\]/i);
  if (!match) return 0;
  const datetime = match[1];
  const offsetNum = Number.parseInt(match[2], 10);
  if (!Number.isFinite(offsetNum)) return 0;
  const sign = offsetNum >= 0 ? "+" : "-";
  const abs = Math.abs(offsetNum).toString().padStart(2, "0");
  const iso = `${datetime.replace(" ", "T")}${sign}${abs}:00`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSystemTerminalText(text: string): ParsedSystemTerminal | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /System:\s*(?:\[[^\]]+\]\s*)?Exec\s+(finished|denied|failed)\s*\(gateway id=([a-f0-9-]+)(?:,\s*([^)]+))?\)\s*:?\s*([^\n]*)?/i,
  );
  if (!match) return null;
  const phase = match[1]?.toLowerCase();
  const gatewayId = (match[2] ?? "").trim();
  const extra = (match[3] ?? "").trim().toLowerCase();
  const commandTail = (match[4] ?? "").trim();
  const approvalId = gatewayId.split("-")[0]?.trim() || undefined;
  let status: ExecLifecycleStatus = "error";
  if (phase === "finished") status = "completed";
  if (phase === "failed") status = "error";
  if (phase === "denied") {
    status =
      extra.includes("approval-timeout") || extra.includes("timed out") ? "timeout" : "denied";
  }
  const atMs = parseSystemTs(trimmed);
  return {
    status,
    gatewayId: gatewayId || undefined,
    approvalId,
    command: commandTail || undefined,
    atMs,
  };
}

function mapStatusToPartState(status: ExecLifecycleStatus): DynamicToolUIPart["state"] {
  if (status === "completed") return "output-available";
  return "output-error";
}

function mapStatusToDecision(
  status: ExecLifecycleStatus,
): "allow-once" | "allow-always" | "deny" | "timeout" | undefined {
  if (status === "denied") return "deny";
  if (status === "timeout") return "timeout";
  return undefined;
}

function findLatestPendingApproval(params: {
  queue: ReturnType<typeof useExecApprovalsStore.getState>["queue"];
  sessionKey: string;
  command: string;
  toolCallId: string;
  runId?: string;
}) {
  const normalizedCommand = params.command.trim();
  if (!normalizedCommand) return null;
  const normalizedRunId =
    params.runId?.trim() || extractRunIdFromToolCallId(params.toolCallId) || "";

  const candidates = params.queue.filter(
    (entry) =>
      entry.request.sessionKey === params.sessionKey &&
      (entry.request.command ?? "").trim() === normalizedCommand,
  );
  if (!candidates.length) return null;

  const exactToolCall = candidates
    .filter((entry) => (entry.request.toolCallId ?? "").trim() === params.toolCallId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
  if (exactToolCall) return exactToolCall;

  if (normalizedRunId) {
    const exactRun = candidates
      .filter((entry) => (entry.request.runId ?? "").trim() === normalizedRunId)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
    if (exactRun) return exactRun;
  }

  const now = Date.now();
  return (
    candidates
      .filter((entry) => now - entry.createdAtMs <= 120_000)
      .sort((a, b) => b.createdAtMs - a.createdAtMs)[0] ?? null
  );
}

function buildSyncSignature(records: ExecLifecycleRecord[]): string {
  return records
    .map((record) =>
      [
        record.attemptId,
        record.lifecycleKey,
        record.status,
        record.messageId,
        record.partIndex,
        record.approvalId ?? "",
        record.gatewayId ?? "",
        record.updatedAtMs,
        record.endedAtMs ?? "",
        record.decision ?? "",
      ].join("|"),
    )
    .join(";");
}

function resolveAttemptIdForTerminal(params: {
  terminal: ParsedSystemTerminal;
  sessionKey: string;
  recordsByKey: Record<string, ExecLifecycleRecord>;
  attemptIdByApprovalId: Record<string, string>;
  attemptIdByGatewayId: Record<string, string>;
  latestAttemptIdBySessionCommand: Record<string, string>;
}): string | undefined {
  const { terminal } = params;
  if (terminal.gatewayId && params.attemptIdByGatewayId[terminal.gatewayId]) {
    return params.attemptIdByGatewayId[terminal.gatewayId];
  }
  if (terminal.approvalId && params.attemptIdByApprovalId[terminal.approvalId]) {
    return params.attemptIdByApprovalId[terminal.approvalId];
  }
  if (terminal.command) {
    const sessionCommandKey = buildSessionCommandKey(params.sessionKey, terminal.command);
    const fromSessionCommand = params.latestAttemptIdBySessionCommand[sessionCommandKey];
    if (fromSessionCommand) return fromSessionCommand;
  }

  const latestRunning = Object.values(params.recordsByKey)
    .filter(
      (record) =>
        record.sessionKey === params.sessionKey && !isTerminalExecLifecycleStatus(record.status),
    )
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
  return latestRunning?.attemptId;
}

function createTerminalRecord(
  base: ExecLifecycleRecord,
  terminal: ParsedSystemTerminal,
): ExecLifecycleRecord {
  const atMs = terminal.atMs || base.updatedAtMs;
  return {
    ...base,
    status: terminal.status,
    partState: mapStatusToPartState(terminal.status),
    preliminary: false,
    command: base.command || terminal.command || "",
    normalizedCommand: base.normalizedCommand || (terminal.command ?? "").trim(),
    updatedAtMs: Math.max(base.updatedAtMs, atMs),
    endedAtMs: Math.max(base.endedAtMs ?? 0, atMs) || atMs,
    approvalId: base.approvalId ?? terminal.approvalId,
    gatewayId: base.gatewayId ?? terminal.gatewayId,
    decision: mapStatusToDecision(terminal.status) ?? base.decision,
  };
}

export function useExecToolRenderItems(
  input: UseExecToolRenderItemsInput,
): UseExecToolRenderItemsResult {
  const { message, sessionKey } = input;
  const [approvalQueue, runningByKey] = useExecApprovalsStore(
    useShallow((s) => [s.queue, s.runningByKey]),
  );
  const [
    recordsByKey,
    attemptIdByApprovalId,
    attemptIdByGatewayId,
    attemptIdByToolCallId,
    latestAttemptIdBySessionCommand,
  ] = useExecLifecycleStore(
    useShallow((s) => [
      s.recordsByKey,
      s.attemptIdByApprovalId,
      s.attemptIdByGatewayId,
      s.attemptIdByToolCallId,
      s.latestAttemptIdBySessionCommand,
    ]),
  );
  const lastSyncSignatureRef = useRef("");

  const projection = useMemo(() => {
    const pendingLifecycleByKey = new Map<string, ExecLifecycleRecord>();
    const execItemsByIndex = new Map<number, UseExecToolRenderItem>();
    const seenAttempts = new Set<string>();

    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];
      if (part.type !== "dynamic-tool") continue;
      if (!isExecToolName(part.toolName)) continue;

      const command = readCommandFromInput(part.input);
      const derivedRunId = extractRunIdFromToolCallId(part.toolCallId) || undefined;
      const pendingApproval = findLatestPendingApproval({
        queue: approvalQueue,
        sessionKey,
        command,
        toolCallId: part.toolCallId,
        runId: derivedRunId,
      });
      const approvalRequested =
        (part.state === "input-available" || part.state === "input-streaming") &&
        Boolean(pendingApproval);
      const runningMarked = Boolean(
        command && runningByKey[makeExecApprovalKey(sessionKey, command)],
      );
      const runId = pendingApproval?.request.runId ?? derivedRunId;
      const fromToolCall = attemptIdByToolCallId[part.toolCallId];
      const attemptId =
        (pendingApproval?.id ? `approval:${pendingApproval.id}` : "") ||
        fromToolCall ||
        (command
          ? buildFallbackAttemptId({
              runId,
              sessionKey,
              command,
              toolCallId: part.toolCallId,
            })
          : "");
      if (!attemptId && !command) continue;

      const partTimestamp = parseToolCallTimestamp(part.toolCallId);
      const projected = projectExecLifecycleRecord({
        part: part as DynamicToolUIPart,
        sessionKey,
        messageId: message.id,
        partIndex: index,
        now: partTimestamp || index + 1,
        approvalRequested,
        approvalId: pendingApproval?.id,
        runningMarked,
        runId,
        attemptId: attemptId || undefined,
      });
      const currentPending = pendingLifecycleByKey.get(projected.attemptId);
      const mergedPending = currentPending
        ? mergeExecLifecycleRecord(currentPending, projected)
        : projected;
      pendingLifecycleByKey.set(projected.attemptId, mergedPending);

      if (seenAttempts.has(projected.attemptId)) continue;
      seenAttempts.add(projected.attemptId);

      const authoritative = recordsByKey[projected.attemptId];
      if (
        authoritative &&
        authoritative.messageId !== message.id &&
        (isTerminalExecLifecycleStatus(authoritative.status) ||
          authoritative.updatedAtMs >= mergedPending.updatedAtMs)
      ) {
        continue;
      }

      const record = authoritative
        ? mergeExecLifecycleRecord(authoritative, mergedPending)
        : mergedPending;
      if (!record.command.trim()) continue;
      execItemsByIndex.set(index, {
        attemptId: record.attemptId,
        node: <ExecActionItem key={`exec:${record.attemptId}:${index}`} record={record} />,
      });
    }

    for (let index = 0; index < message.parts.length; index += 1) {
      const part = message.parts[index];
      if (part.type !== "text") continue;
      const terminal = parseSystemTerminalText(part.text);
      if (!terminal) continue;

      const targetAttemptId = resolveAttemptIdForTerminal({
        terminal,
        sessionKey,
        recordsByKey,
        attemptIdByApprovalId,
        attemptIdByGatewayId,
        latestAttemptIdBySessionCommand,
      });
      if (!targetAttemptId) continue;

      const base = pendingLifecycleByKey.get(targetAttemptId) ?? recordsByKey[targetAttemptId];
      if (!base) continue;
      const nextTerminal = createTerminalRecord(base, terminal);
      pendingLifecycleByKey.set(targetAttemptId, nextTerminal);
    }

    return {
      itemsByIndex: Object.fromEntries(execItemsByIndex) as UseExecToolRenderItemsResult,
      pendingLifecycle: Array.from(pendingLifecycleByKey.values()),
    };
  }, [
    approvalQueue,
    attemptIdByApprovalId,
    attemptIdByGatewayId,
    attemptIdByToolCallId,
    latestAttemptIdBySessionCommand,
    message.id,
    message.parts,
    recordsByKey,
    runningByKey,
    sessionKey,
  ]);

  useEffect(() => {
    if (!projection.pendingLifecycle.length) return;
    const signature = buildSyncSignature(projection.pendingLifecycle);
    if (signature === lastSyncSignatureRef.current) return;
    lastSyncSignatureRef.current = signature;
    useExecLifecycleStore.getState().upsertBatch(projection.pendingLifecycle);
  }, [projection.pendingLifecycle]);

  return projection.itemsByIndex;
}
