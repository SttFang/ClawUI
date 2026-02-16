export {
  TOOL_CALL_STATE_PRIORITY,
  isHigherOrEqualPriority,
  isInputState,
  isOutputState,
  isSyntheticToolCallId,
  normalizeToolCallId,
  resolveToolCallId,
  toolStatePriority,
} from "@clawui/types/tool-call";
export type { ToolCallState } from "@clawui/types/tool-call";

/**
 * Extract the run ID from a tool-call ID.
 *
 * Some IDs are compound: `runId:tool`, `runId:tool-N`, or `runId|extra`.
 * This helper normalizes first, then strips the `:tool*` suffix.
 */
export function extractRunIdFromToolCallId(toolCallId: string): string {
  const normalized = toolCallId.trim();
  if (!normalized) return "";
  const base = normalized.includes("|") ? normalized.split("|")[0] : normalized;
  const markerIndex = base.indexOf(":tool");
  if (markerIndex > 0) return base.slice(0, markerIndex);
  return base;
}
