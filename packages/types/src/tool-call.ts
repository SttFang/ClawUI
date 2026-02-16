/**
 * Canonical ToolCall normalization layer — single source of truth.
 *
 * Eliminates duplicate definitions previously scattered across:
 * - `openclaw-chat-stream/transcript.ts`
 * - `src/lib/exec/normalize.ts`
 * - `src/store/execLifecycle/listener.ts`
 * - `src/store/runMap/helpers.ts`
 * - `src/features/Chat/components/MessageParts.tsx`
 */

export type ToolCallState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

/**
 * Priority ordering for tool-call states.
 * Higher number = more "complete" / takes precedence in merges.
 */
export const TOOL_CALL_STATE_PRIORITY: Record<ToolCallState, number> = {
  "input-available": 1,
  "input-streaming": 2,
  "output-available": 3,
  "output-error": 4,
};

/**
 * Extract the primary tool-call ID from a value that may contain a `|` separator.
 *
 * OpenClaw's ACP protocol appends extra context after a `|` delimiter
 * (e.g. `call_abc123|extra-info`). When the primary segment starts with
 * `call_` we strip the suffix; otherwise we return the full value.
 */
export function normalizeToolCallId(value: string): string {
  const normalized = value.trim();
  if (!normalized) return normalized;
  const separatorIndex = normalized.indexOf("|");
  if (separatorIndex <= 0) return normalized;
  const primary = normalized.slice(0, separatorIndex).trim();
  if (!primary) return normalized;
  if (primary.startsWith("call_")) return primary;
  return normalized;
}

/**
 * Resolve a tool-call ID from a record with inconsistent field naming.
 *
 * Unified candidate list (superset of all call-sites):
 * `toolCallId`, `tool_call_id`, `toolUseId`, `tool_use_id`, `toolId`, `id`
 *
 * The result is passed through `normalizeToolCallId`.
 */
export function resolveToolCallId(
  record: Record<string, unknown> | null,
): string {
  if (!record) return "";
  const candidates = [
    record.toolCallId,
    record.tool_call_id,
    record.toolUseId,
    record.tool_use_id,
    record.toolId,
    record.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeToolCallId(candidate.trim());
    }
  }
  return "";
}

/**
 * Check if a tool-call ID is synthetic (generated as a fallback, not from the provider).
 */
export function isSyntheticToolCallId(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized.endsWith(":tool") || normalized.includes(":tool-"))
    return true;
  if (normalized.startsWith("assistant:") || normalized.startsWith("system:"))
    return true;
  return false;
}

export function isInputState(state: unknown): boolean {
  return state === "input-available" || state === "input-streaming";
}

export function isOutputState(state: unknown): boolean {
  return state === "output-available" || state === "output-error";
}

export function toolStatePriority(state: unknown): number {
  if (typeof state !== "string") return 0;
  return TOOL_CALL_STATE_PRIORITY[state as ToolCallState] ?? 0;
}

/**
 * Returns true if `incoming` state is higher or equal priority than `current`.
 */
export function isHigherOrEqualPriority(
  incoming: unknown,
  current: unknown,
): boolean {
  return toolStatePriority(incoming) >= toolStatePriority(current);
}
