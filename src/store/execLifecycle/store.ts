import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ExecLifecycleStore } from "./types";
import { initialState } from "./initialState";
import {
  buildSessionCommandKey,
  isTerminalExecLifecycleStatus,
  mergeExecLifecycleRecord,
} from "./projector";

function isSameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isSameStringRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function isSameLifecycleRecord(
  previous: ExecLifecycleStore["recordsByKey"][string] | undefined,
  next: ExecLifecycleStore["recordsByKey"][string],
): boolean {
  if (!previous) return false;
  return (
    previous.attemptId === next.attemptId &&
    previous.lifecycleKey === next.lifecycleKey &&
    previous.runId === next.runId &&
    previous.sessionKey === next.sessionKey &&
    previous.command === next.command &&
    previous.normalizedCommand === next.normalizedCommand &&
    previous.status === next.status &&
    previous.gatewayId === next.gatewayId &&
    previous.requestId === next.requestId &&
    previous.decision === next.decision &&
    previous.toolCallId === next.toolCallId &&
    previous.toolName === next.toolName &&
    previous.messageId === next.messageId &&
    previous.partIndex === next.partIndex &&
    previous.partState === next.partState &&
    previous.preliminary === next.preliminary &&
    previous.startedAtMs === next.startedAtMs &&
    previous.updatedAtMs === next.updatedAtMs &&
    previous.endedAtMs === next.endedAtMs &&
    previous.approvalId === next.approvalId &&
    previous.cwd === next.cwd &&
    previous.yieldMs === next.yieldMs &&
    previous.errorText === next.errorText &&
    isSameStringArray(previous.sourceToolCallIds, next.sourceToolCallIds)
  );
}

function buildIndexesFromRecords(recordsByKey: ExecLifecycleStore["recordsByKey"]) {
  const attemptIdByApprovalId: Record<string, string> = {};
  const attemptIdByGatewayId: Record<string, string> = {};
  const attemptIdByToolCallId: Record<string, string> = {};
  const latestAttemptIdBySessionCommand: Record<string, string> = {};
  const latestStartedAtBySessionCommand: Record<string, number> = {};

  for (const record of Object.values(recordsByKey)) {
    const attemptId = record.attemptId || record.lifecycleKey;
    if (!attemptId) continue;

    if (record.approvalId) attemptIdByApprovalId[record.approvalId] = attemptId;
    if (record.gatewayId) attemptIdByGatewayId[record.gatewayId] = attemptId;
    if (record.toolCallId) attemptIdByToolCallId[record.toolCallId] = attemptId;
    for (const toolCallId of record.sourceToolCallIds) {
      if (!toolCallId) continue;
      attemptIdByToolCallId[toolCallId] = attemptId;
    }

    if (!record.normalizedCommand) continue;
    if (isTerminalExecLifecycleStatus(record.status)) continue;
    const sessionCommandKey = buildSessionCommandKey(record.sessionKey, record.normalizedCommand);
    const currentAt = latestStartedAtBySessionCommand[sessionCommandKey] ?? -1;
    const candidateAt = record.updatedAtMs || record.startedAtMs;
    const shouldReplace =
      candidateAt > currentAt ||
      (candidateAt === currentAt && !isTerminalExecLifecycleStatus(record.status));
    if (!shouldReplace) continue;
    latestStartedAtBySessionCommand[sessionCommandKey] = candidateAt;
    latestAttemptIdBySessionCommand[sessionCommandKey] = attemptId;
  }

  return {
    attemptIdByApprovalId,
    attemptIdByGatewayId,
    attemptIdByToolCallId,
    latestAttemptIdBySessionCommand,
  };
}

function isSameIndexes(
  state: ExecLifecycleStore,
  next: ReturnType<typeof buildIndexesFromRecords>,
): boolean {
  return (
    isSameStringRecord(state.attemptIdByApprovalId, next.attemptIdByApprovalId) &&
    isSameStringRecord(state.attemptIdByGatewayId, next.attemptIdByGatewayId) &&
    isSameStringRecord(state.attemptIdByToolCallId, next.attemptIdByToolCallId) &&
    isSameStringRecord(state.latestAttemptIdBySessionCommand, next.latestAttemptIdBySessionCommand)
  );
}

export const useExecLifecycleStore = create<ExecLifecycleStore>()(
  devtools(
    (set) => ({
      ...initialState,
      upsert: (record) =>
        set(
          (state) => {
            const key = record.attemptId || record.lifecycleKey;
            if (!key) return state;
            const current = state.recordsByKey[key];
            const nextRecord = current ? mergeExecLifecycleRecord(current, record) : record;
            if (isSameLifecycleRecord(current, nextRecord)) return state;
            const nextRecords = {
              ...state.recordsByKey,
              [key]: nextRecord,
            };
            const nextIndexes = buildIndexesFromRecords(nextRecords);
            if (isSameIndexes(state, nextIndexes)) {
              return { recordsByKey: nextRecords };
            }
            return {
              recordsByKey: nextRecords,
              ...nextIndexes,
            };
          },
          false,
          "execLifecycle/upsert",
        ),
      upsertBatch: (records) =>
        set(
          (state) => {
            if (!records.length) return state;
            let nextRecords = state.recordsByKey;
            let changed = false;
            for (const record of records) {
              const key = record.attemptId || record.lifecycleKey;
              if (!key) continue;
              const current = nextRecords[key];
              const merged = current ? mergeExecLifecycleRecord(current, record) : record;
              if (isSameLifecycleRecord(current, merged)) continue;
              if (!changed) {
                nextRecords = { ...nextRecords };
                changed = true;
              }
              nextRecords[key] = merged;
            }
            if (!changed) return state;
            const nextIndexes = buildIndexesFromRecords(nextRecords);
            if (isSameIndexes(state, nextIndexes)) {
              return { recordsByKey: nextRecords };
            }
            return {
              recordsByKey: nextRecords,
              ...nextIndexes,
            };
          },
          false,
          "execLifecycle/upsertBatch",
        ),
      clearSession: (sessionKey) =>
        set(
          (state) => {
            const normalized = sessionKey.trim();
            if (!normalized) return state;
            const nextRecords = Object.fromEntries(
              Object.entries(state.recordsByKey).filter(
                ([, record]) => record.sessionKey !== normalized,
              ),
            );
            if (Object.keys(nextRecords).length === Object.keys(state.recordsByKey).length) {
              return state;
            }
            const nextIndexes = buildIndexesFromRecords(nextRecords);
            return {
              recordsByKey: nextRecords,
              ...nextIndexes,
            };
          },
          false,
          "execLifecycle/clearSession",
        ),
      reset: () =>
        set(
          () => ({
            ...initialState,
          }),
          false,
          "execLifecycle/reset",
        ),
    }),
    { name: "ExecLifecycleStore" },
  ),
);
