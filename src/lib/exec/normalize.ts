/**
 * Canonical normalization helpers for exec-related identifiers.
 *
 * These utilities are shared across stores, hooks, and UI components
 * to ensure a single source of truth for key derivation.
 */

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
 * Build a compound key `"sessionKey::command"` for approval dedup.
 * Accepts nullable sessionKey for convenience at call-sites.
 */
export function makeExecApprovalKey(
  sessionKey: string | null | undefined,
  command: string,
): string {
  return `${normalizeSessionKey(sessionKey)}::${command}`;
}
