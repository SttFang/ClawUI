import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

export const STREAMDOWN_PLUGINS = {
  code,
  mermaid,
  // OpenClaw 输出里经常用 `$...$` 做行内公式；这里显式开启。
  math: createMathPlugin({ singleDollarTextMath: true }),
  cjk,
};

export function stripOpenClawReplyTags(text: string): string {
  // OpenClaw 的 reply tag 只用于 channel 投递/回复控制，不应暴露给用户。
  // 常见形式：
  // - [[reply_to:<messageId>]]
  // - [[reply_to_current]]
  return text.replaceAll(/\[\[reply_to:[^\]]+\]\]/g, "").replaceAll("[[reply_to_current]]", "");
}

export function stripTerminalControlSequences(text: string): string {
  const esc = String.fromCharCode(27);
  const bel = String.fromCharCode(7);
  const ansiCsiPattern = new RegExp(`${esc}\\[[0-?]*[ -/]*[@-~]`, "g");
  const ansiOscPattern = new RegExp(`${esc}\\][^${bel}]*(?:${bel}|${esc}\\\\)`, "g");
  const leakedCsiPattern = new RegExp("\\[\\?(?:25[hl]|2004[hl])\\b", "g");
  return (
    text
      // CSI sequences, e.g. "\u001b[?25h" / "\u001b[?25l"
      .replaceAll(ansiCsiPattern, "")
      // OSC sequences
      .replaceAll(ansiOscPattern, "")
      // Some logs lose ESC and leave a raw fragment like "[?25h"
      .replaceAll(leakedCsiPattern, "")
  );
}

export function normalizeMathDelimiters(markdown: string): string {
  // 将 `\\( ... \\)` / `\\[ ... \\]` 转成 remark-math 可解析的 `$` / `$$`。
  // 为了避免破坏 fenced code block，这里只在非 ``` fence 区域做替换。
  const lines = markdown.split("\n");
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) continue;

    lines[i] = line
      .replaceAll("\\[", "$$")
      .replaceAll("\\]", "$$")
      .replaceAll("\\(", "$")
      .replaceAll("\\)", "$");
  }

  return lines.join("\n");
}
