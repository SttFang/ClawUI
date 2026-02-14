import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ExecCard } from "@/features/Chat/components/A2UI";
import { getCommandFromInput, isExecToolName } from "@/lib/exec";
import {
  createTerminalRecord,
  parseSystemTerminalText,
  parseToolCallTimestamp,
} from "@/lib/exec/systemTextParsing";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/exec";
import {
  buildFallbackAttemptId,
  buildSessionCommandKey,
  extractRunIdFromToolCallId,
  isTerminalExecLifecycleStatus,
  mergeExecLifecycleRecord,
  projectExecLifecycleRecord,
  useExecLifecycleStore,
  type ExecLifecycleRecord,
} from "@/store/exec";

type UseExecToolRenderItemsInput = {
  message: UIMessage;
  sessionKey: string;
};

type UseExecToolRenderItem = {
  attemptId: string;
  node: ReactElement;
};

type UseExecToolRenderItemsResult = Record<number, UseExecToolRenderItem>;

// ---------------------------------------------------------------------------
// Approval-queue resolution
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Terminal-text → attempt resolution
// ---------------------------------------------------------------------------

function resolveAttemptIdForTerminal(params: {
  terminal: { gatewayId?: string; approvalId?: string; command?: string };
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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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

  const execItemsByIndex = useMemo(() => {
    const pendingLifecycleByKey = new Map<string, ExecLifecycleRecord>();
    const result = new Map<number, UseExecToolRenderItem>();
    const seenAttempts = new Set<string>();

    // Phase 1: project exec tool parts → lifecycle records
    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];
      if (part.type !== "dynamic-tool") continue;
      if (!isExecToolName(part.toolName)) continue;

      const command = getCommandFromInput(part.input);
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
          ? buildFallbackAttemptId({ runId, sessionKey, command, toolCallId: part.toolCallId })
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

      // Look up authoritative record from store — try projected attemptId first,
      // then fall back to toolCallId index (handles approval:X ≠ attempt:Y mismatch)
      const authoritative =
        recordsByKey[projected.attemptId] ||
        (fromToolCall && fromToolCall !== projected.attemptId
          ? recordsByKey[fromToolCall]
          : undefined);

      const record = authoritative
        ? mergeExecLifecycleRecord(authoritative, mergedPending)
        : mergedPending;
      if (!record.command.trim()) continue;
      result.set(index, {
        attemptId: record.attemptId,
        node: <ExecCard key={`exec:${record.attemptId}:${index}`} record={record} />,
      });
    }

    // Phase 2: parse "System: Exec finished/denied/failed ..." terminal text
    // GATEWAY_DEPENDENCY: relies on unstructured text; replace when Gateway emits structured events
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
      pendingLifecycleByKey.set(targetAttemptId, createTerminalRecord(base, terminal));
    }

    return Object.fromEntries(result) as UseExecToolRenderItemsResult;
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

  return execItemsByIndex;
}
