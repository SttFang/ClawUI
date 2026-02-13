export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeSessionKey(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toText(value: unknown): string | null {
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return normalizeText(String(value));
  return null;
}

export function collectText(value: unknown, out: string[]): void {
  const direct = toText(value);
  if (direct) {
    out.push(direct);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (!isRecord(value)) return;

  const keys = [
    "text",
    "content",
    "message",
    "summary",
    "error",
    "result",
    "output",
    "value",
    "input",
  ] as const;
  for (const key of keys) {
    const nested = value[key];
    const nestedText = toText(nested);
    if (nestedText) {
      out.push(nestedText);
      continue;
    }
    if (Array.isArray(nested) || isRecord(nested)) {
      collectText(nested, out);
    }
  }
}

export function hashText(sessionKey: string, runId: string | undefined, text: string): string {
  const seed = `${sessionKey}|${runId ?? "<none>"}|${text}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return `${hash.toString(36)}:${seed.length}`;
}
