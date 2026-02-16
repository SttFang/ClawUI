/**
 * Canonical normalization helpers for exec-related identifiers.
 *
 * These utilities are shared across stores, hooks, and UI components
 * to ensure a single source of truth for key derivation.
 */

// Re-export from the shared types package (single source of truth).
export { normalizeToolCallId } from "@clawui/types/tool-call";

/** Collapse whitespace sequences to a single space. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Narrow `unknown` to a plain object. Returns `null` for non-objects. */
export function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Type-guard variant — returns `true` when value is a non-null object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeSessionKey(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeCommand(value: string): string {
  return normalizeWhitespace(value);
}

/**
 * Build a compound key `"sessionKey::command"` for approval dedup.
 * Accepts nullable sessionKey for convenience at call-sites.
 */
export function makeExecApprovalKey(
  sessionKey: string | null | undefined,
  command: string,
): string {
  return `${normalizeSessionKey(sessionKey)}::${command}`;
}
