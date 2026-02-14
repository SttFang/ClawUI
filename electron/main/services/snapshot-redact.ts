import type { ConfigSnapshotV2 } from "@clawui/types/config";

export const REDACTED_SENTINEL = "__CLAWUI_REDACTED__";

const SENSITIVE_KEY_WHITELIST = new Set([
  "maxtokens",
  "maxoutputtokens",
  "maxinputtokens",
  "maxcompletiontokens",
  "contexttokens",
  "totaltokens",
  "tokencount",
  "tokenlimit",
  "tokenbudget",
]);

const SENSITIVE_KEY_PATTERNS = [/token$/i, /password/i, /secret/i, /api.?key/i];

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY_WHITELIST.has(key.toLowerCase())) return false;
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key) && value !== null && value !== undefined) {
      result[key] = REDACTED_SENTINEL;
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function collectSensitiveValues(obj: unknown): string[] {
  const values: string[] = [];
  if (obj === null || obj === undefined || typeof obj !== "object") return values;
  if (Array.isArray(obj)) {
    for (const item of obj) values.push(...collectSensitiveValues(item));
    return values;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key) && typeof value === "string" && value.length > 0) {
      values.push(value);
    } else if (typeof value === "object" && value !== null) {
      values.push(...collectSensitiveValues(value));
    }
  }
  return values;
}

function redactRawText(raw: string, config: unknown): string {
  const sensitiveValues = collectSensitiveValues(config);
  sensitiveValues.sort((a, b) => b.length - a.length);
  let result = raw;
  for (const value of sensitiveValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), REDACTED_SENTINEL);
  }
  return result;
}

export function redactSnapshot(snapshot: ConfigSnapshotV2): ConfigSnapshotV2 {
  return {
    ...snapshot,
    config: redactObject(snapshot.config) as Record<string, unknown>,
    raw: snapshot.raw ? redactRawText(snapshot.raw, snapshot.config) : snapshot.raw,
  };
}

export function restoreRedactedValues(incoming: unknown, original: unknown): unknown {
  if (incoming === null || incoming === undefined || typeof incoming !== "object") return incoming;
  if (Array.isArray(incoming)) {
    const origArr = Array.isArray(original) ? original : [];
    return incoming.map((item, i) => restoreRedactedValues(item, origArr[i]));
  }
  const orig =
    original && typeof original === "object" && !Array.isArray(original)
      ? (original as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (isSensitiveKey(key) && value === REDACTED_SENTINEL) {
      if (!(key in orig)) {
        throw new Error(
          `config write rejected: "${key}" is redacted; set an explicit value instead of ${REDACTED_SENTINEL}`,
        );
      }
      result[key] = orig[key];
    } else if (typeof value === "object" && value !== null) {
      result[key] = restoreRedactedValues(value, orig[key]);
    } else {
      result[key] = value;
    }
  }
  return result;
}
