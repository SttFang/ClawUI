/**
 * ClawUI 要求的最低 OpenClaw 版本。
 * Installer 和 RuntimeDetector 共享此常量。
 */
export const MIN_OPENCLAW_VERSION = "2026.2.9";

/**
 * 解析 OpenClaw 版本字符串为可比较的数字元组。
 *
 * 格式: `YYYY.M.D` 或 `YYYY.M.D-patch`
 * 例如: "2026.2.9", "2026.2.19-2"
 */
function parseVersion(v: string): number[] {
  const [main, patch] = v.split("-");
  const parts = main.split(".").map(Number);
  parts.push(patch ? Number(patch) : 0);
  return parts;
}

/**
 * 比较两个 OpenClaw 版本字符串。
 * 返回 -1 (a < b), 0 (a == b), 1 (a > b)。
 */
export function compareOpenClawVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}
