export function formatSecondsFromMs(ms?: number): number {
  return Math.max(0, Math.round((ms ?? 0) / 1000));
}

function stripShellQuote(token: string): string {
  const trimmed = token.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function extractPrimaryExecCommand(command: string): string {
  const normalized = command.trim();
  if (!normalized) return "";

  const firstLine = normalized.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine) return "";

  const firstSegment = firstLine.split(/\s*(?:&&|\|\||;|\|)\s*/, 1)[0]?.trim() ?? "";
  if (!firstSegment) return "";

  const tokens = firstSegment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  let commandToken = "";
  for (const token of tokens) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token)) continue;
    commandToken = token;
    break;
  }
  if (!commandToken) {
    commandToken = firstSegment.split(/\s+/, 1)[0] ?? "";
  }
  if (!commandToken) return "";

  const unquoted = stripShellQuote(commandToken).replace(/\\/g, "/");
  const baseName = unquoted.split("/").pop() ?? "";
  return baseName.trim();
}

export function titleizeCommandName(commandName: string): string {
  const value = commandName.trim();
  if (!value) return "";
  if (value.length === 1) return value.toUpperCase();
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function outputToText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output == null) return "";
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

export function summarizeOutputText(
  text: string,
  options: { maxLines?: number; maxChars?: number } = {},
): { preview: string; truncated: boolean } {
  const { maxLines = 4, maxChars = 260 } = options;
  const normalized = text.trim();
  if (!normalized) return { preview: "", truncated: false };

  const lines = normalized.split("\n");
  const clippedLines = lines.slice(0, maxLines);
  let preview = clippedLines.join("\n");

  let truncated = lines.length > maxLines;
  if (preview.length > maxChars) {
    preview = preview.slice(0, maxChars);
    truncated = true;
  }

  if (truncated) {
    preview = `${preview.replace(/\s+$/g, "")}…`;
  }

  return { preview, truncated };
}
