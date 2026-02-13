import { INTERNAL_SYSTEM_KIND } from "./constants";
import { collectText, isRecord, normalizeSessionKey } from "./utils";

function messageText(message: Record<string, unknown>): string | null {
  const parts: string[] = [];
  collectText(message.content, parts);
  collectText(message.result, parts);
  collectText(message.output, parts);
  collectText(message.error, parts);
  collectText(message.summary, parts);
  collectText(message.message, parts);
  collectText(message.text, parts);
  collectText(message.value, parts);
  return parts.length > 0 ? parts.join("\n") : null;
}

function readProvenance(record: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = [
    record.inputProvenance,
    record.provenance,
    isRecord(record.meta) ? (record.meta as Record<string, unknown>).inputProvenance : null,
    isRecord(record.metadata) ? (record.metadata as Record<string, unknown>).inputProvenance : null,
    record.meta,
    record.metadata,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate)) return candidate;
  }
  return null;
}

function isInternalSystemUserRecord(record: Record<string, unknown>): boolean {
  const role = typeof record.role === "string" ? record.role.trim().toLowerCase() : "";
  if (role !== "user") return false;
  const provenance = readProvenance(record);
  if (!provenance) return false;
  const kind = typeof provenance.kind === "string" ? provenance.kind.trim().toLowerCase() : "";
  return kind === INTERNAL_SYSTEM_KIND;
}

function resolveMessageRunId(record: Record<string, unknown>): string | undefined {
  const candidates = [
    record.runId,
    record.run_id,
    record.clientRunId,
    record.client_run_id,
    record.agentRunId,
    record.agent_run_id,
    record.traceId,
    record.trace_id,
    isRecord(record.meta) ? (record.meta as Record<string, unknown>).runId : null,
    isRecord(record.meta) ? (record.meta as Record<string, unknown>).run_id : null,
    isRecord(record.meta) ? (record.meta as Record<string, unknown>).traceId : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (value) return value;
  }
  return undefined;
}

function readTimestamp(record: Record<string, unknown>): number {
  const candidates = [
    record.timestamp,
    record.createdAt,
    record.createdAtMs,
    record.ts,
    record.time,
    record.created_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return Date.now();
}

export function pickLastHistoryText(params: {
  messages: unknown;
  sessionKey: string;
  runId?: string;
}): string | null {
  if (!Array.isArray(params.messages)) return null;

  let best: { atMs: number; text: string } | null = null;
  for (const raw of params.messages) {
    if (!isRecord(raw)) continue;

    const messageSession = normalizeSessionKey(
      typeof raw.sessionKey === "string" ? raw.sessionKey : undefined,
    );
    if (messageSession && messageSession !== params.sessionKey) continue;
    if (isInternalSystemUserRecord(raw)) continue;

    const role = typeof raw.role === "string" ? raw.role.toLowerCase() : "";
    if (!role) continue;

    const candidateRunId = resolveMessageRunId(raw);
    if (params.runId && candidateRunId && candidateRunId !== params.runId) continue;

    const text = messageText(raw);
    if (!text) continue;

    const atMs = readTimestamp(raw);
    if (!best || atMs > best.atMs) best = { atMs, text };
  }

  return best?.text ?? null;
}
