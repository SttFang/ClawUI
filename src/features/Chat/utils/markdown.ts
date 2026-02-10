import { code } from '@streamdown/code'
import { cjk } from '@streamdown/cjk'
import { createMathPlugin } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'

export const STREAMDOWN_PLUGINS = {
  code,
  mermaid,
  // OpenClaw 输出里经常用 `$...$` 做行内公式；这里显式开启。
  math: createMathPlugin({ singleDollarTextMath: true }),
  cjk,
}

export function stripOpenClawReplyTags(text: string): string {
  // OpenClaw 的 reply tag 只用于 channel 投递/回复控制，不应暴露给用户。
  // 常见形式：
  // - [[reply_to:<messageId>]]
  // - [[reply_to_current]]
  return text
    .replaceAll(/\[\[reply_to:[^\]]+\]\]/g, '')
    .replaceAll('[[reply_to_current]]', '')
}

export function normalizeMathDelimiters(markdown: string): string {
  // 将 `\\( ... \\)` / `\\[ ... \\]` 转成 remark-math 可解析的 `$` / `$$`。
  // 为了避免破坏 fenced code block，这里只在非 ``` fence 区域做替换。
  const lines = markdown.split('\n')
  let inFence = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''

    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }

    if (inFence) continue

    lines[i] = line
      .replaceAll('\\[', '$$')
      .replaceAll('\\]', '$$')
      .replaceAll('\\(', '$')
      .replaceAll('\\)', '$')
  }

  return lines.join('\n')
}

