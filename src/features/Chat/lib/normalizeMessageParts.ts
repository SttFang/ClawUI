import type { DynamicToolUIPart, UIMessage } from "ai";
import { isLikelyToolReceiptText } from "@/lib/exec/systemTextParsing";
import { normalizeToolCallId, toolStatePriority } from "@/lib/tool-call";

function isEmptyInput(input: unknown): boolean {
  if (input == null) return true;
  const str = typeof input === "string" ? input : JSON.stringify(input);
  return !str || str === "{}" || str === "[]";
}

function deduplicateToolParts(parts: DynamicToolUIPart[]): DynamicToolUIPart[] {
  const byId = new Map<string, DynamicToolUIPart>();
  for (const part of parts) {
    const id = normalizeToolCallId(part.toolCallId);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, part);
      continue;
    }
    const existingPri = toolStatePriority(existing.state);
    const currentPri = toolStatePriority(part.state);
    if (currentPri > existingPri) {
      const mergedInput =
        isEmptyInput(part.input) && !isEmptyInput(existing.input) ? existing.input : part.input;
      byId.set(id, { ...part, input: mergedInput });
    } else if (isEmptyInput(existing.input) && !isEmptyInput(part.input)) {
      byId.set(id, { ...existing, input: part.input });
    }
  }
  return Array.from(byId.values());
}

type TextPartLike = { type: "text"; text: string };

function isTextPart(part: unknown): part is TextPartLike {
  if (!part || typeof part !== "object") return false;
  const r = part as Record<string, unknown>;
  return r.type === "text" && typeof r.text === "string";
}

function isDynamicToolPart(part: unknown): part is DynamicToolUIPart {
  if (!part || typeof part !== "object") return false;
  const r = part as Record<string, unknown>;
  return (
    r.type === "dynamic-tool" && typeof r.toolCallId === "string" && typeof r.toolName === "string"
  );
}

/**
 * Normalize message parts before rendering:
 * - Filter receipt text (system/exec/approval messages)
 * - Normalize toolCallId (strip fc suffix)
 * - Fix non-streaming tool state to output-available
 * - Deduplicate tool parts by normalized ID
 */
export function normalizeMessageParts(
  parts: UIMessage["parts"],
  opts: { streaming: boolean },
): UIMessage["parts"] {
  const result: UIMessage["parts"] = [];

  for (const part of parts) {
    if (isTextPart(part)) {
      if (!part.text.trim()) continue;
      if (isLikelyToolReceiptText(part.text)) continue;
      result.push(part);
      continue;
    }

    if (isDynamicToolPart(part)) {
      const stableId = normalizeToolCallId(part.toolCallId);
      const needsIdNorm = stableId && stableId !== part.toolCallId;
      const needsStateNorm =
        !opts.streaming && part.state !== "output-available" && part.state !== "output-error";
      if (needsIdNorm || needsStateNorm) {
        result.push({
          ...part,
          ...(needsIdNorm ? { toolCallId: stableId } : undefined),
          ...(needsStateNorm ? { state: "output-available" as const } : undefined),
        } as DynamicToolUIPart);
      } else {
        result.push(part);
      }
      continue;
    }

    result.push(part);
  }

  return result;
}

export { deduplicateToolParts };
