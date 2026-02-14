import { isExecToolName } from "@/lib/exec";

export type ToolRenderKind = "explore" | "exec" | "generic" | "hidden";

export type ToolRenderPolicy = {
  kind: ToolRenderKind;
  maxPreviewChars?: number;
};

export const EXPLORE_PREVIEW_CHARS = 600;

const HIDDEN_TOOL_NAMES = new Set(["session_status"]);

const EXPLORE_TOOL_NAMES = new Set(["read", "search", "glob", "grep", "list_dir"]);

export function isExploreToolName(toolName: string): boolean {
  return EXPLORE_TOOL_NAMES.has(toolName.trim().toLowerCase());
}

export function classifyToolRender(toolName: string): ToolRenderPolicy {
  const normalized = toolName.trim().toLowerCase();
  if (!normalized) return { kind: "generic" };

  if (HIDDEN_TOOL_NAMES.has(normalized)) {
    return { kind: "hidden" };
  }
  if (isExecToolName(toolName)) {
    return { kind: "exec" };
  }
  if (isExploreToolName(toolName)) {
    return { kind: "explore", maxPreviewChars: EXPLORE_PREVIEW_CHARS };
  }

  return { kind: "generic" };
}
