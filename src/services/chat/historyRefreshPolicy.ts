import type { ExecApprovalRequest } from "@/store/execApprovals";

export const APPROVAL_RECOVERY_FOLLOWUPS_MS = [
  500, 1_500, 3_000, 6_000, 10_000, 15_000, 20_000, 30_000, 45_000, 60_000, 90_000,
] as const;

export function shouldRefreshHistoryOnHeartbeat(params: {
  sessionKey: string;
  queue: ExecApprovalRequest[];
  runningByKey: Record<string, number>;
}): boolean {
  const { sessionKey, queue, runningByKey } = params;
  const normalizedSessionKey = sessionKey.trim();
  if (!normalizedSessionKey) return false;

  const hasPending = queue.some(
    (entry) => (entry.request.sessionKey ?? "").trim() === normalizedSessionKey,
  );
  if (hasPending) return true;

  return Object.keys(runningByKey).some((key) => key.startsWith(`${normalizedSessionKey}::`));
}
