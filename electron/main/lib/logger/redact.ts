// ---------------------------------------------------------------------------
// Sensitive-data filter — prevents tokens & API keys from leaking into logs
// ---------------------------------------------------------------------------

const MAX_DEPTH = 10;

// Regex patterns for token strings embedded in free-form text
const SENSITIVE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-proj-[A-Za-z0-9_-]+/g, // OpenAI project key
  /xoxb-[A-Za-z0-9_-]+/g,
  /xapp-[A-Za-z0-9_-]+/g,
  /ghp_[A-Za-z0-9]{36,}/g, // GitHub PAT
  /gho_[A-Za-z0-9]{36,}/g, // GitHub OAuth
  /github_pat_[A-Za-z0-9_]{22,}/g, // GitHub fine-grained PAT
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /sk_live_[A-Za-z0-9]{24,}/g, // Stripe live secret
  /sk_test_[A-Za-z0-9]{24,}/g, // Stripe test secret
  /rk_live_[A-Za-z0-9]{24,}/g, // Stripe restricted
  /rk_test_[A-Za-z0-9]{24,}/g, // Stripe restricted test
  /discord\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{27,}/g, // Discord bot token
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g, // Bearer token in text
  /SG\.[A-Za-z0-9_-]{22,}\.[A-Za-z0-9_-]{43,}/g, // SendGrid API key
  /npm_[A-Za-z0-9]{36,}/g, // npm token
  /pypi-[A-Za-z0-9_-]{40,}/g, // PyPI token
  /[A-Za-z0-9_-]{48,}/g, // generic long token catch-all
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
  "api-key",
  "secret",
  "secret_key",
  "private_key",
  "x-api-key",
  "proxy-authorization",
  "set-cookie",
  "credentials",
  "email",
  "phone",
]);

function _redact(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[MaxDepth]";

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
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value.map((item) => _redact(item, seen, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = _redact(val, seen, depth + 1);
      }
    }
    return result;
  }

  return value;
}

export function redact(value: unknown): unknown {
  return _redact(value, new WeakSet(), 0);
}
