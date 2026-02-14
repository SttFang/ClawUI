import { isExecToolName, isReadToolName } from "@/lib/exec";

export type ToolRenderKind = "exec_card" | "read_compact" | "generic_card" | "hidden";

export type ToolRenderPolicy = {
  kind: ToolRenderKind;
  maxPreviewChars?: number;
};

export const READ_COMPACT_PREVIEW_CHARS = 600;

const HIDDEN_TOOL_NAMES = new Set(["session_status"]);

export function classifyToolRender(toolName: string): ToolRenderPolicy {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return { kind: "generic_card" };

  if (isExecToolName(toolName)) {
    return { kind: "exec_card" };
  }
  if (HIDDEN_TOOL_NAMES.has(normalized)) {
    return { kind: "hidden" };
  }
  if (isReadToolName(toolName)) {
    return {
      kind: "read_compact",
      maxPreviewChars: READ_COMPACT_PREVIEW_CHARS,
    };
  }

  return { kind: "generic_card" };
}
