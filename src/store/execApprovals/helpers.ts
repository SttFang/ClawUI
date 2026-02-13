import type {
  ExecApprovalDecision,
  ExecApprovalRequest,
  ExecApprovalRequestPayload,
} from "./types";

export const EXEC_RUNNING_TTL_MS = 2 * 60 * 1000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRequestPayload(value: Record<string, unknown>): ExecApprovalRequestPayload | null {
  const command = typeof value.command === "string" ? value.command.trim() : "";
  if (!command) return null;

  return {
    command,
    cwd: typeof value.cwd === "string" ? value.cwd : null,
    host: typeof value.host === "string" ? value.host : null,
    security: typeof value.security === "string" ? value.security : null,
    ask: typeof value.ask === "string" ? value.ask : null,
    agentId: typeof value.agentId === "string" ? value.agentId : null,
    resolvedPath: typeof value.resolvedPath === "string" ? value.resolvedPath : null,
    sessionKey: typeof value.sessionKey === "string" ? value.sessionKey : null,
  };
}

export function parseExecApprovalRequested(payload: unknown): ExecApprovalRequest | null {
  if (!isRecord(payload)) return null;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;

  const requestRaw = payload.request;
  if (!isRecord(requestRaw)) return null;
  const request = parseRequestPayload(requestRaw);
  if (!request) return null;

  const createdAtMs = typeof payload.createdAtMs === "number" ? payload.createdAtMs : 0;
  const expiresAtMs = typeof payload.expiresAtMs === "number" ? payload.expiresAtMs : 0;
  if (!createdAtMs || !expiresAtMs) return null;

  return { id, request, createdAtMs, expiresAtMs };
}

export function parseExecApprovalResolved(payload: unknown): {
  id: string;
  decision: ExecApprovalDecision | null;
  atMs: number;
  sessionKey?: string;
  command?: string;
  idSource: "payload.id" | "payload.request.id";
} | null {
  if (!isRecord(payload)) return null;
  const requestRaw = isRecord(payload.request) ? payload.request : null;
  const directId = typeof payload.id === "string" ? payload.id.trim() : "";
  const nestedId = requestRaw && typeof requestRaw.id === "string" ? requestRaw.id.trim() : "";
  const id = directId || nestedId;
  if (!id) return null;
  const idSource: "payload.id" | "payload.request.id" = directId
    ? "payload.id"
    : "payload.request.id";

  const decisionRaw = payload.decision;
  const decision: ExecApprovalDecision | null =
    decisionRaw === "allow-once" || decisionRaw === "allow-always" || decisionRaw === "deny"
      ? decisionRaw
      : null;
  const sessionKey = normalizeSessionKey(
    requestRaw && typeof requestRaw.sessionKey === "string"
      ? requestRaw.sessionKey
      : typeof payload.sessionKey === "string"
        ? payload.sessionKey
        : null,
  );
  const commandRaw =
    requestRaw && typeof requestRaw.command === "string"
      ? requestRaw.command
      : typeof payload.command === "string"
        ? payload.command
        : "";
  const command = commandRaw.trim();
  const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
  return {
    id,
    decision,
    atMs: ts,
    sessionKey: sessionKey || undefined,
    command: command || undefined,
    idSource,
  };
}

export function prune(queue: ExecApprovalRequest[]): ExecApprovalRequest[] {
  const now = Date.now();
  return queue.filter((entry) => entry.expiresAtMs > now);
}

export function normalizeSessionKey(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function makeExecApprovalKey(
  sessionKey: string | null | undefined,
  command: string,
): string {
  return `${sessionKey ?? ""}::${command}`;
}
