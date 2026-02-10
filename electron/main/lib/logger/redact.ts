// ---------------------------------------------------------------------------
// Sensitive-data filter — prevents tokens & API keys from leaking into logs
// ---------------------------------------------------------------------------

// Regex patterns for token strings embedded in free-form text
const SENSITIVE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /xoxb-[A-Za-z0-9_-]+/g,
  /xapp-[A-Za-z0-9_-]+/g,
  /[A-Za-z0-9_-]{40,}/g, // generic long token catch-all
];

// Key-based filtering for structured objects (best-effort)
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "apikey",
  "api_key",
  "secret",
  "email",
  "phone",
]);

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, (match) => {
        if (match.length <= 8) return match; // too short to be a token
        return `${match.slice(0, 4)}***${match.slice(-4)}`;
      });
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redact(val);
      }
    }
    return result;
  }

  return value;
}
