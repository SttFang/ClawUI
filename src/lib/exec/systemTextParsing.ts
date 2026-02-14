import type { DynamicToolUIPart } from "ai";
import type { ExecLifecycleRecord, ExecLifecycleStatus } from "@/store/execLifecycle/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedSystemTerminal = {
  status: ExecLifecycleStatus;
  gatewayId?: string;
  approvalId?: string;
  command?: string;
  atMs: number;
};

// ---------------------------------------------------------------------------
// GATEWAY_DEPENDENCY: OpenClaw Gateway exec-completion text format
//
// Gateway emits text like:
//   "System: [2026-02-14 16:34:03 GMT+8] Exec finished (gateway id=<uuid>, ...): <command>"
//   "System: Exec denied (gateway id=<uuid>, approval-timeout)"
//   "System: Exec failed (gateway id=<uuid>): <command>"
//
// When Gateway moves to structured events, replace these parsers.
// ---------------------------------------------------------------------------

/** Parse a `[YYYY-MM-DD HH:MM:SS GMT±N]` timestamp from Gateway system text. */
export function parseSystemTs(text: string): number {
  const match = text.match(
    /\[(?<datetime>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+GMT(?<offset>[+-]\d{1,2})\]/i,
  );
  if (!match?.groups) return 0;
  const { datetime, offset } = match.groups;
  const offsetNum = Number.parseInt(offset, 10);
  if (!Number.isFinite(offsetNum)) return 0;
  const sign = offsetNum >= 0 ? "+" : "-";
  const abs = Math.abs(offsetNum).toString().padStart(2, "0");
  const iso = `${datetime.replace(" ", "T")}${sign}${abs}:00`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parse a Gateway "System: Exec finished/denied/failed (...)" message.
 *
 * GATEWAY_DEPENDENCY: relies on unstructured text format.
 */
export function parseSystemTerminalText(text: string): ParsedSystemTerminal | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^System:\s*(?:\[[^\]]+\]\s*)?Exec\s+(?<phase>finished|denied|failed)\s*\(gateway id=(?<gwId>[a-f0-9-]+)(?:,\s*(?<extra>[^)]+))?\)\s*:?\s*(?<cmdTail>[^\n]*)?/i,
  );
  if (!match?.groups) return null;

  const { phase, gwId, extra, cmdTail } = match.groups;
  const phaseLower = (phase ?? "").toLowerCase();
  const gatewayId = (gwId ?? "").trim();
  const extraLower = (extra ?? "").trim().toLowerCase();
  const commandTail = (cmdTail ?? "").trim();
  const approvalId = gatewayId.split("-")[0]?.trim() || undefined;

  let status: ExecLifecycleStatus = "error";
  if (phaseLower === "finished") status = "completed";
  if (phaseLower === "failed") status = "error";
  if (phaseLower === "denied") {
    status =
      extraLower.includes("approval-timeout") || extraLower.includes("timed out")
        ? "timeout"
        : "denied";
  }

  const atMs = parseSystemTs(trimmed);
  return {
    status,
    gatewayId: gatewayId || undefined,
    approvalId,
    command: commandTail || undefined,
    atMs,
  };
}

/**
 * Detect Gateway system/receipt text that should be hidden from chat display.
 *
 * Uses strict `^System:` boundary to avoid false positives on user messages
 * that happen to contain "system:" in the middle.
 */
export function isLikelyToolReceiptText(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith("system:") ||
    normalized.startsWith("approval required") ||
    normalized.startsWith("approve to run") ||
    (normalized.startsWith("{") && normalized.includes('"status"') && normalized.includes('"tool"'))
  );
}

// ---------------------------------------------------------------------------
// Tool-call ID timestamp extraction
// ---------------------------------------------------------------------------

/** Extract a millisecond timestamp embedded in a tool call ID. */
export function parseToolCallTimestamp(toolCallId: string): number {
  const assistantMatch = toolCallId.match(/assistant:(\d{10,})/);
  if (assistantMatch) {
    const parsed = Number.parseInt(assistantMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const genericMatch = toolCallId.match(/:(\d{10,})(?::|$)/);
  if (genericMatch) {
    const parsed = Number.parseInt(genericMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Terminal-record helpers
// ---------------------------------------------------------------------------

export function mapStatusToPartState(status: ExecLifecycleStatus): DynamicToolUIPart["state"] {
  return status === "completed" ? "output-available" : "output-error";
}

export function mapStatusToDecision(
  status: ExecLifecycleStatus,
): "allow-once" | "allow-always" | "deny" | "timeout" | undefined {
  if (status === "denied") return "deny";
  if (status === "timeout") return "timeout";
  return undefined;
}

/** Merge a terminal (end-state) result into an existing lifecycle record. */
export function createTerminalRecord(
  base: ExecLifecycleRecord,
  terminal: ParsedSystemTerminal,
): ExecLifecycleRecord {
  const atMs = terminal.atMs || base.updatedAtMs;
  return {
    ...base,
    status: terminal.status,
    partState: mapStatusToPartState(terminal.status),
    preliminary: false,
    command: base.command || terminal.command || "",
    normalizedCommand: base.normalizedCommand || (terminal.command ?? "").trim(),
    updatedAtMs: Math.max(base.updatedAtMs, atMs),
    endedAtMs: Math.max(base.endedAtMs ?? 0, atMs) || atMs,
    approvalId: base.approvalId ?? terminal.approvalId,
    gatewayId: base.gatewayId ?? terminal.gatewayId,
    decision: mapStatusToDecision(terminal.status) ?? base.decision,
  };
}
