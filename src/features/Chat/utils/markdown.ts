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

export function compactTableLeadingBlankLines(markdown: string): string {
  // 用户粘贴数据时经常在表格前带大量空行，这会放大流式渲染里的视觉空白。
  // 仅在"紧邻 GFM 表格头"的位置压缩为最多 1 个空行，避免误伤其它段落结构。
  return markdown.replaceAll(/\n{3,}(?=[ \t]*\|[^\n]+\|\s*\n[ \t]*\|[ \t:|-]+\|)/g, "\n\n");
}

/**
 * 将消息文本中的 workspace 绝对路径转为 markdown 链接，
 * 使用 `workspace-file:` 协议供下游 WorkspaceLink 组件拦截渲染。
 *
 * 支持文件路径和目录路径，也处理 backtick 包裹的路径。
 * 跳过已在 markdown 链接 `[...](...)` 和 fenced code block 中的路径。
 */
export function linkifyWorkspacePaths(text: string): string {
  // 匹配 /.openclaw/workspace/ 后的相对路径（文件或目录）
  // 外层可选 backtick 包裹：`path`
  const pathRe =
    /`?(\/[^\s`"'<>]*?\/\.openclaw\/workspace\/([^\s`"'<>)]+?))`?(?=[\s,;:。，；：！？)\]}>]|$)/g;

  const lines = text.split("\n");
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";

    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    lines[i] = line.replaceAll(pathRe, (_match, _fullPath: string, relativePath: string) => {
      const idx = line.indexOf(_match);
      const before = line.slice(0, idx);

      // 在 markdown 链接的 href 中：`](...)`
      if (/\]\([^)]*$/.test(before)) return _match;

      // 在 backtick 包裹的 inline code 中但不是整个匹配都被包裹
      // （整个 `path` 匹配到的话，外层 backtick 已被正则消费，直接替换即可）
      const backtickCount = (before.match(/`/g) ?? []).length;
      const matchHasBackticks = _match.startsWith("`");
      if (!matchHasBackticks && backtickCount % 2 === 1) return _match;

      const label = relativePath.replace(/\/$/, "").split("/").pop() ?? relativePath;
      return `[${label}](#workspace-file=${relativePath})`;
    });
  }

  return lines.join("\n");
}

export function shouldParseIncompleteMarkdown(text: string): boolean {
  if (!text) return false;
  if (/\[[^\]]*$/.test(text)) return true;
  if (/\[[^\]]+\]\([^)]+$/.test(text)) return true;

  const openBrackets = (text.match(/\[/g) ?? []).length;
  const closeBrackets = (text.match(/\]/g) ?? []).length;
  if (openBrackets > closeBrackets) return true;

  const openParens = (text.match(/\(/g) ?? []).length;
  const closeParens = (text.match(/\)/g) ?? []).length;
  return openParens > closeParens;
}
