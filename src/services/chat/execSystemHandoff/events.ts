import type { HandOffSource } from "./types";
import { APPROVAL_DECISIONS, EXEC_TOOL_FALLBACK, TOOL_NAMES } from "./constants";
import { collectText, isRecord, normalizeSessionKey, normalizeText } from "./utils";

function parseApprovalDecision(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return APPROVAL_DECISIONS.has(normalized) ? normalized : null;
}

export function parseApprovalEvent(payload: unknown): {
  id: string;
  decision: string | null;
  command?: string;
  sessionKey?: string;
} | null {
  if (!isRecord(payload)) return null;

  const request = isRecord(payload.request) ? (payload.request as Record<string, unknown>) : null;
  const id =
    typeof payload.id === "string"
      ? payload.id.trim()
      : request && typeof request.id === "string"
        ? request.id.trim()
        : "";
  if (!id) return null;

  const decision = parseApprovalDecision(payload.decision);
  const command =
    request && typeof request.command === "string"
      ? request.command.trim()
      : typeof payload.command === "string"
        ? payload.command.trim()
        : "";
  const sessionKey = normalizeSessionKey(
    request && typeof request.sessionKey === "string"
      ? request.sessionKey
      : typeof payload.sessionKey === "string"
        ? payload.sessionKey
        : undefined,
  );

  return { id, decision, command: command || undefined, sessionKey: sessionKey || undefined };
}

export function resolveApprovalHandoff(params: { decision: string | null; command?: string }): {
  source: HandOffSource;
  text?: string;
} {
  const command = normalizeText(params.command ?? "");
  if (params.decision === "deny") {
    return {
      source: "approval-deny",
      text: command
        ? `Execution denied for command: ${command}`
        : "Execution denied while waiting for approval.",
    };
  }
  if (params.decision === "allow-once" || params.decision === "allow-always") {
    return {
      source: "approval-allow",
      text: command ? `Execution approved for: ${command}` : "Execution approved.",
    };
  }
  if (params.decision === "timeout") {
    return { source: "approval-timeout", text: "Execution timed out while waiting for approval." };
  }
  return { source: "approval-unknown" };
}

export function readToolEventText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const phase = typeof payload.phase === "string" ? payload.phase.trim().toLowerCase() : "";
  if (phase !== "result" && phase !== "error" && phase !== "end") return null;

  const name =
    typeof payload.name === "string"
      ? payload.name.trim().toLowerCase()
      : typeof payload.toolName === "string"
        ? payload.toolName.trim().toLowerCase()
        : typeof payload.tool_name === "string"
          ? payload.tool_name.trim().toLowerCase()
          : "";
  if (!TOOL_NAMES.has(name)) return null;

  const isError = payload.isError === true || phase === "error";
  const result =
    payload.result !== undefined
      ? payload.result
      : payload.output !== undefined
        ? payload.output
        : payload.partialResult;
  const parts: string[] = [];
  collectText(result, parts);
  const fallback = normalizeText(parts.join("\n"));

  if (fallback) return isError ? `Exec failed: ${fallback}` : fallback;
  if (isError) return "Exec failed.";
  if (phase === "end") return EXEC_TOOL_FALLBACK;
  return null;
}

export function isLikelyApprovalPromptText(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  return normalized.includes("approval required") || normalized.includes("approve to run");
}

export function isLikelyTerminalResultText(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  if (isLikelyApprovalPromptText(normalized)) return false;
  return (
    normalized.includes("exec finished") ||
    normalized.includes("exec denied") ||
    normalized.includes("exec failed") ||
    normalized.includes("timed out while waiting for approval") ||
    normalized.includes("no output - tool completed successfully") ||
    normalized.includes("enoent:") ||
    (normalized.includes('"status"') &&
      (normalized.includes('"error"') ||
        normalized.includes('"ok"') ||
        normalized.includes('"code"')))
  );
}

function readChatMessageText(message: unknown): string | null {
  if (!isRecord(message)) return null;
  const parts: string[] = [];
  collectText(message.content, parts);
  collectText(message.text, parts);
  collectText(message.result, parts);
  collectText(message.output, parts);
  const text = normalizeText(parts.join("\n"));
  return text || null;
}

export function parseChatTerminalEvent(payload: unknown): {
  sessionKey: string;
  runId?: string;
  text: string;
} | null {
  if (!isRecord(payload)) return null;
  const sessionKey = normalizeSessionKey(
    typeof payload.sessionKey === "string" ? payload.sessionKey : null,
  );
  if (!sessionKey) return null;

  const state = typeof payload.state === "string" ? payload.state.trim().toLowerCase() : "";
  if (state !== "final" && state !== "error" && state !== "aborted") return null;

  const text = readChatMessageText(payload.message);
  if (!text || !isLikelyTerminalResultText(text)) return null;

  const runId =
    typeof payload.runId === "string" && payload.runId.trim() ? payload.runId.trim() : undefined;

  return { sessionKey, runId, text };
}
