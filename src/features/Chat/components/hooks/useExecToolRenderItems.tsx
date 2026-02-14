import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef } from "react";
import { ExecActionItem } from "@/components/A2UI";
import { makeExecApprovalKey, useExecApprovalsStore } from "@/store/execApprovals";
import {
  isTerminalExecLifecycleStatus,
  mergeExecLifecycleRecord,
  projectExecLifecycleRecord,
  useExecLifecycleStore,
  type ExecLifecycleRecord,
} from "@/store/execLifecycle";

type UseExecToolRenderItemsInput = {
  message: UIMessage;
  sessionKey: string;
};

type UseExecToolRenderItemsResult = Record<number, ReactElement>;

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

function findLatestPendingApproval(params: {
  queue: ReturnType<typeof useExecApprovalsStore.getState>["queue"];
  sessionKey: string;
  command: string;
}) {
  const normalizedCommand = params.command.trim();
  if (!normalizedCommand) return null;
  return params.queue
    .filter(
      (entry) =>
        entry.request.sessionKey === params.sessionKey &&
        (entry.request.command ?? "").trim() === normalizedCommand,
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
}

function buildSyncSignature(records: ExecLifecycleRecord[]): string {
  return records
    .map((record) =>
      [
        record.lifecycleKey,
        record.status,
        record.messageId,
        record.partIndex,
        record.approvalId ?? "",
        record.updatedAtMs,
        record.errorText ?? "",
        record.cwd ?? "",
        record.yieldMs ?? "",
      ].join("|"),
    )
    .join(";");
}

export function useExecToolRenderItems(
  input: UseExecToolRenderItemsInput,
): UseExecToolRenderItemsResult {
  const { message, sessionKey } = input;
  const approvalQueue = useExecApprovalsStore((s) => s.queue);
  const runningByKey = useExecApprovalsStore((s) => s.runningByKey);
  const lifecycleByKey = useExecLifecycleStore((s) => s.recordsByKey);
  const lastSyncSignatureRef = useRef("");

  const projection = useMemo(() => {
    const pendingLifecycleByKey = new Map<string, ExecLifecycleRecord>();
    const execItemsByIndex = new Map<number, ReactElement>();
    const seenExecLifecycleKeys = new Set<string>();

    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];
      if (part.type !== "dynamic-tool") continue;
      if (!isExecToolName(part.toolName)) continue;

      const command = readCommandFromInput(part.input);
      const pendingApproval = findLatestPendingApproval({
        queue: approvalQueue,
        sessionKey,
        command,
      });
      const approvalRequested =
        (part.state === "input-available" || part.state === "input-streaming") &&
        Boolean(pendingApproval);
      const runningMarked = Boolean(
        command && runningByKey[makeExecApprovalKey(sessionKey, command)],
      );
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
        runId: pendingApproval?.request.runId ?? undefined,
      });
      const currentPending = pendingLifecycleByKey.get(projected.lifecycleKey);
      const mergedPending = currentPending
        ? mergeExecLifecycleRecord(currentPending, projected)
        : projected;
      pendingLifecycleByKey.set(projected.lifecycleKey, mergedPending);

      if (seenExecLifecycleKeys.has(projected.lifecycleKey)) continue;
      seenExecLifecycleKeys.add(projected.lifecycleKey);

      const authoritative = lifecycleByKey[projected.lifecycleKey];
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
      execItemsByIndex.set(
        index,
        <ExecActionItem key={`exec:${projected.lifecycleKey}:${index}`} record={record} />,
      );
    }

    return {
      itemsByIndex: Object.fromEntries(execItemsByIndex) as UseExecToolRenderItemsResult,
      pendingLifecycle: Array.from(pendingLifecycleByKey.values()),
    };
  }, [approvalQueue, lifecycleByKey, message.id, message.parts, runningByKey, sessionKey]);

  useEffect(() => {
    if (!projection.pendingLifecycle.length) return;
    const signature = buildSyncSignature(projection.pendingLifecycle);
    if (signature === lastSyncSignatureRef.current) return;
    lastSyncSignatureRef.current = signature;
    useExecLifecycleStore.getState().upsertBatch(projection.pendingLifecycle);
  }, [projection.pendingLifecycle]);

  return projection.itemsByIndex;
}
