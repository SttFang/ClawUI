export type ToolRenderKind = "exec_card" | "read_compact" | "generic_card" | "hidden";

export type ToolRenderPolicy = {
  kind: ToolRenderKind;
  maxPreviewChars?: number;
};

export const READ_COMPACT_PREVIEW_CHARS = 600;

const EXEC_TOOL_NAMES = new Set(["exec", "bash"]);
const HIDDEN_TOOL_NAMES = new Set(["session_status"]);

function normalizeToolName(value: string): string {
  return value.trim().toLowerCase();
}

export function classifyToolRender(toolName: string): ToolRenderPolicy {
  const normalized = normalizeToolName(toolName);
  if (!normalized) return { kind: "generic_card" };

  if (EXEC_TOOL_NAMES.has(normalized)) {
    return { kind: "exec_card" };
  }
  if (HIDDEN_TOOL_NAMES.has(normalized)) {
    return { kind: "hidden" };
  }
  if (normalized === "read") {
    return {
      kind: "read_compact",
      maxPreviewChars: READ_COMPACT_PREVIEW_CHARS,
    };
  }

  return { kind: "generic_card" };
}
