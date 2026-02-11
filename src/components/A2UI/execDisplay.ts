export function formatSecondsFromMs(ms?: number): number {
  return Math.max(0, Math.round((ms ?? 0) / 1000));
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
