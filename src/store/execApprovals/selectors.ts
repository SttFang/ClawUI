import type { ExecApprovalRequest, ExecApprovalsStore } from "./types";
import { normalizeSessionKey, prune } from "./helpers";

export const selectQueue = (state: ExecApprovalsStore) => state.queue;
export const selectBusyById = (state: ExecApprovalsStore) => state.busyById;
export const selectRunningByKey = (state: ExecApprovalsStore) => state.runningByKey;
export const selectLastResolvedBySession = (state: ExecApprovalsStore) =>
  state.lastResolvedBySession;

export function getPendingApprovalsForSession(
  queue: ExecApprovalRequest[],
  sessionKey: string | null | undefined,
): ExecApprovalRequest[] {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) return [];
  const active = prune(queue);
  const filtered = active.filter(
    (entry) => normalizeSessionKey(entry.request.sessionKey) === normalized,
  );
  return [...filtered].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function selectPendingBySession(
  state: ExecApprovalsStore,
  sessionKey: string | null | undefined,
): ExecApprovalRequest[] {
  return getPendingApprovalsForSession(state.queue, sessionKey);
}

export function selectLatestBySession(
  state: ExecApprovalsStore,
  sessionKey: string | null | undefined,
): ExecApprovalRequest | null {
  return getPendingApprovalsForSession(state.queue, sessionKey)[0] ?? null;
}

export const execApprovalsSelectors = {
  selectQueue,
  selectBusyById,
  selectRunningByKey,
  selectLastResolvedBySession,
  selectPendingBySession,
  selectLatestBySession,
};
