/**
 * Unified ExecStore — merges ExecApprovals + ExecLifecycle + A2UIExecTrace
 * into a single store for exec tool state management.
 *
 * Re-exports from the original stores for backward compatibility during
 * the migration period. Consumers should gradually migrate to the
 * unified imports from `@/store/exec`.
 */

// --- ExecApprovals ---
export { useExecApprovalsStore } from "@/store/execApprovals";
export { initExecApprovalsListener } from "@/store/execApprovals";
export { makeExecApprovalKey } from "@/store/execApprovals";
export {
  selectQueue,
  selectBusyById,
  selectRunningByKey,
  selectLastResolvedBySession,
  getPendingApprovalsForSession,
  selectPendingBySession,
  selectLatestBySession,
  execApprovalsSelectors,
} from "@/store/execApprovals";
export type {
  ExecApprovalDecision,
  ExecApprovalRequest,
  ExecApprovalRequestPayload,
  LastResolvedApproval,
  ExecApprovalsState,
  ExecApprovalsActions,
  ExecApprovalsStore,
} from "@/store/execApprovals";

// --- ExecLifecycle ---
export { useExecLifecycleStore } from "@/store/execLifecycle";
export { initExecLifecycleListener } from "@/store/execLifecycle";
export {
  buildFallbackAttemptId,
  buildExecLifecycleKey,
  buildSessionCommandKey,
  deriveExecLifecycleStatus,
  extractRunIdFromToolCallId,
  isTerminalExecLifecycleStatus,
  mergeExecLifecycleRecord,
  projectExecLifecycleRecord,
} from "@/store/execLifecycle";
export {
  selectAttemptIdByApprovalId,
  selectAttemptIdByGatewayId,
  selectAttemptIdByToolCallId,
  selectExecLifecycleByKey,
  selectExecLifecycleBySession,
  selectLatestAttemptIdBySessionCommand,
  execLifecycleSelectors,
} from "@/store/execLifecycle";
export type {
  ExecLifecycleRecord,
  ExecLifecycleStatus,
  ExecLifecycleStore,
} from "@/store/execLifecycle";

// --- A2UIExecTrace ---
export { useA2UIExecTraceStore } from "@/store/a2uiExecTrace";
export {
  selectTraces,
  selectTerminals,
  selectTraceByKey,
  selectTerminalByKey,
  a2uiExecTraceSelectors,
} from "@/store/a2uiExecTrace";
export type {
  ExecTraceRecord,
  ExecTraceStatus,
  ExecTerminalRecord,
  ExecTraceUpdatePayload,
  A2UIExecTraceState,
} from "@/store/a2uiExecTrace";
