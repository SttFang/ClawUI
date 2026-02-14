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

export function selectAttemptIdByApprovalId(
  state: ExecLifecycleState,
  approvalId: string,
): string | undefined {
  return state.attemptIdByApprovalId[approvalId];
}

export function selectAttemptIdByGatewayId(
  state: ExecLifecycleState,
  gatewayId: string,
): string | undefined {
  return state.attemptIdByGatewayId[gatewayId];
}

export function selectAttemptIdByToolCallId(
  state: ExecLifecycleState,
  toolCallId: string,
): string | undefined {
  return state.attemptIdByToolCallId[toolCallId];
}

export function selectLatestAttemptIdBySessionCommand(
  state: ExecLifecycleState,
  sessionCommandKey: string,
): string | undefined {
  return state.latestAttemptIdBySessionCommand[sessionCommandKey];
}
