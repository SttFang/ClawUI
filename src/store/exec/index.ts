/**
 * Unified ExecStore — merges ExecApprovals + ExecLifecycle + A2UIExecTrace
 * into a single store for exec tool state management.
 *
 * Re-exports from the original stores for backward compatibility during
 * the migration period. Consumers should gradually migrate to the
 * unified imports from `@/store/exec`.
 */

// Re-export original stores as compatibility layer
export { useExecApprovalsStore } from "@/store/execApprovals";
export { initExecApprovalsListener } from "@/store/execApprovals";
export { makeExecApprovalKey } from "@/store/execApprovals";
export type {
  ExecApprovalDecision,
  ExecApprovalRequest,
  ExecApprovalRequestPayload,
  ExecApprovalsState,
  ExecApprovalsStore,
} from "@/store/execApprovals";

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
export type {
  ExecLifecycleRecord,
  ExecLifecycleStatus,
  ExecLifecycleStore,
} from "@/store/execLifecycle";

export { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
export type {
  ExecTraceRecord,
  ExecTraceStatus,
  ExecTerminalRecord,
  A2UIExecTraceState,
} from "@/store/a2uiExecTrace/types";

// Re-export shared utilities
export {
  isExecToolName,
  isReadToolName,
  getCommandFromInput,
  normalizeSessionKey,
  normalizeCommand,
  normalizeToolCallId,
  makeExecApprovalKey as makeExecKey,
  toRecord,
  isRecord,
} from "@/lib/exec";
