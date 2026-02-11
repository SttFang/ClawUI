import type { UIMessage } from "ai";

function safeJsonLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

function hashString(value: string): string {
  // FNV-1a 32-bit hash: deterministic and fast for UI-side change detection.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function safeJsonHash(value: unknown): string {
  try {
    return hashString(JSON.stringify(value));
  } catch {
    return "0";
  }
}

export function buildHistoryFingerprint(messages: UIMessage[]): string {
  const normalized = messages.map((message, index) => {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    return {
      index,
      id: message.id ?? "",
      role: message.role ?? "",
      parts: parts.map((part) => {
        if (!part || typeof part !== "object") return { type: "unknown" };
        const p = part as Record<string, unknown>;
        const type = typeof p.type === "string" ? p.type : "unknown";
        if (type === "text") {
          const text = typeof p.text === "string" ? p.text : "";
          return { type, textLen: text.length, textHash: hashString(text) };
        }
        if (type === "dynamic-tool") {
          return {
            type,
            toolCallId: typeof p.toolCallId === "string" ? p.toolCallId : "",
            state: typeof p.state === "string" ? p.state : "",
            inputLen: safeJsonLength(p.input ?? null),
            outputLen: safeJsonLength(p.output ?? null),
            inputHash: safeJsonHash(p.input ?? null),
            outputHash: safeJsonHash(p.output ?? null),
          };
        }
        return {
          type,
          len: safeJsonLength(p),
          hash: safeJsonHash(p),
        };
      }),
    };
  });
  return `${messages.length}:${JSON.stringify(normalized)}`;
}
