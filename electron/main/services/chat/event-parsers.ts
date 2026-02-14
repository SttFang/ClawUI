import { isRecord } from "../../utils/type-guards";

export function pickToolCallId(record: Record<string, unknown>): string {
  const candidates = [
    record.toolCallId,
    record.tool_call_id,
    record.toolUseId,
    record.tool_use_id,
    record.id,
    record.toolId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function normalizeToolMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const toolCallId = pickToolCallId(data);
  if (!toolCallId) return data;
  if (typeof data.toolCallId === "string" && data.toolCallId.trim()) return data;
  return { ...data, toolCallId };
}

export function extractTextFromMessage(message: unknown): string | undefined {
  if (!isRecord(message)) return undefined;
  const content = message.content;
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    if (!isRecord(item)) continue;
    const text = item.text;
    if (typeof text === "string" && text.trim()) return text;
  }
  return undefined;
}
