import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ExecLifecycleStore } from "./types";
import { initialState } from "./initialState";
import { mergeExecLifecycleRecord } from "./projector";

function isSameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isSameLifecycleRecord(
  previous: ExecLifecycleStore["recordsByKey"][string] | undefined,
  next: ExecLifecycleStore["recordsByKey"][string],
): boolean {
  if (!previous) return false;
  return (
    previous.lifecycleKey === next.lifecycleKey &&
    previous.runId === next.runId &&
    previous.sessionKey === next.sessionKey &&
    previous.command === next.command &&
    previous.normalizedCommand === next.normalizedCommand &&
    previous.status === next.status &&
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

export const useExecLifecycleStore = create<ExecLifecycleStore>()(
  devtools(
    (set) => ({
      ...initialState,
      upsert: (record) =>
        set(
          (state) => {
            const current = state.recordsByKey[record.lifecycleKey];
            const next = current ? mergeExecLifecycleRecord(current, record) : record;
            if (isSameLifecycleRecord(current, next)) return state;
            return {
              recordsByKey: {
                ...state.recordsByKey,
                [record.lifecycleKey]: next,
              },
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
              const current = nextRecords[record.lifecycleKey];
              const merged = current ? mergeExecLifecycleRecord(current, record) : record;
              if (isSameLifecycleRecord(current, merged)) continue;
              if (!changed) {
                nextRecords = { ...nextRecords };
                changed = true;
              }
              nextRecords[record.lifecycleKey] = merged;
            }
            if (!changed) return state;
            return { recordsByKey: nextRecords };
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
            return { recordsByKey: nextRecords };
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
