import { resolve, sep } from "node:path";

/**
 * Resolve `userInput` under `baseDir` and verify the result stays within `baseDir`.
 * Throws if the resolved path escapes the base directory (path traversal).
 */
export function safePath(baseDir: string, userInput: string): string {
  const base = resolve(baseDir) + sep;
  const resolved = resolve(baseDir, userInput);
  if (!resolved.startsWith(base) && resolved !== resolve(baseDir)) {
    throw new Error("Path traversal not allowed");
  }
  return resolved;
}
