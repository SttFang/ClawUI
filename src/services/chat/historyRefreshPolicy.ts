import type { ExecApprovalRequest } from "@/store/execApprovals";

const HEARTBEAT_BASE_THROTTLE_MS = 2_500;
const RECOVERY_HEARTBEAT_BASE_THROTTLE_MS = 1_200;
const HEARTBEAT_BACKOFF_MULTIPLIER = 1.5;
const RECOVERY_HEARTBEAT_BACKOFF_MAX_MS = 10_000;
const HEARTBEAT_BACKOFF_MAX_STEPS = 10;

const unchangedBySession = new Map<string, number>();

export const APPROVAL_RECOVERY_FOLLOWUPS_MS = [
  800, 2_000, 5_000, 10_000, 15_000, 30_000, 45_000, 60_000,
] as const;

function getSessionBackoffKey(sessionKey: string): string {
  return sessionKey.trim();
}

export function recordHistoryRefreshResult(sessionKey: string, changed: boolean): void {
  const key = getSessionBackoffKey(sessionKey);
  if (!key) return;
  if (changed) {
    unchangedBySession.set(key, 0);
    return;
  }
  const current = unchangedBySession.get(key) ?? 0;
  unchangedBySession.set(key, Math.min(current + 1, HEARTBEAT_BACKOFF_MAX_STEPS));
}

export function resetHeartbeatBackoff(sessionKey: string): void {
  const key = getSessionBackoffKey(sessionKey);
  if (!key) return;
  unchangedBySession.set(key, 0);
}

export function getEffectiveHeartbeatThrottleMs(params: {
  sessionKey: string;
  recoveryActive?: boolean;
}): number {
  const key = getSessionBackoffKey(params.sessionKey);
  if (!params.recoveryActive || !key) {
    return HEARTBEAT_BASE_THROTTLE_MS;
  }

  const unchanged = unchangedBySession.get(key) ?? 0;
  const dynamic = RECOVERY_HEARTBEAT_BASE_THROTTLE_MS * HEARTBEAT_BACKOFF_MULTIPLIER ** unchanged;
  return Math.min(Math.round(dynamic), RECOVERY_HEARTBEAT_BACKOFF_MAX_MS);
}

export function shouldRefreshHistoryOnHeartbeat(params: {
  sessionKey: string;
  queue: ExecApprovalRequest[];
  runningByKey: Record<string, number>;
  recoveryActive?: boolean;
}): boolean {
  const { sessionKey, queue, runningByKey, recoveryActive } = params;
  const normalizedSessionKey = sessionKey.trim();
  if (!normalizedSessionKey) return false;
  if (recoveryActive) return true;

  const hasPending = queue.some(
    (entry) => (entry.request.sessionKey ?? "").trim() === normalizedSessionKey,
  );
  if (hasPending) return true;

  return Object.keys(runningByKey).some((key) => key.startsWith(`${normalizedSessionKey}::`));
}
