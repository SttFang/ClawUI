/** Canonical tool-name guard functions for exec/bash and read tools. */

export function isExecToolName(toolName: string): boolean {
  const normalized = toolName.trim().toLowerCase();
  return normalized === "exec" || normalized === "bash";
}

export function isReadToolName(toolName: string): boolean {
  return toolName.trim().toLowerCase() === "read";
}
