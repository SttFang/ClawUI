import type { ExecLifecycleRecord, ExecLifecycleState } from "./types";

export function selectExecLifecycleByKey(
  state: ExecLifecycleState,
  lifecycleKey: string,
): ExecLifecycleRecord | undefined {
  return state.recordsByKey[lifecycleKey];
}

export function selectExecLifecycleBySession(
  state: ExecLifecycleState,
  sessionKey: string,
): ExecLifecycleRecord[] {
  const normalized = sessionKey.trim();
  if (!normalized) return [];
  return Object.values(state.recordsByKey)
    .filter((record) => record.sessionKey === normalized)
    .sort((a, b) => a.startedAtMs - b.startedAtMs);
}
