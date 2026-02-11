import type { UIMessage } from "ai";

function safeJsonLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

export function buildHistoryFingerprint(messages: UIMessage[]): string {
  const tail = messages.slice(-2);
  const normalized = tail.map((message) => {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    return {
      id: message.id ?? "",
      role: message.role ?? "",
      parts: parts.map((part) => {
        if (!part || typeof part !== "object") return { type: "unknown" };
        const p = part as Record<string, unknown>;
        const type = typeof p.type === "string" ? p.type : "unknown";
        if (type === "text") {
          return { type, text: typeof p.text === "string" ? p.text : "" };
        }
        if (type === "dynamic-tool") {
          return {
            type,
            toolCallId: typeof p.toolCallId === "string" ? p.toolCallId : "",
            state: typeof p.state === "string" ? p.state : "",
            inputLen: safeJsonLength(p.input ?? null),
            outputLen: safeJsonLength(p.output ?? null),
          };
        }
        return { type };
      }),
    };
  });
  return `${messages.length}:${JSON.stringify(normalized)}`;
}
