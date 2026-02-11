import type { UIMessage } from 'ai'

type ContentBlock = Record<string, unknown> & { type?: unknown }

function pickNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function contentHashHint(content: unknown): string {
  if (content == null) return '0'
  const source = typeof content === 'string' ? content : JSON.stringify(content)
  if (!source) return '0'
  let hash = 0x811c9dc5
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}:${source.length.toString(36)}`
}

function resolveStableMessageId(record: Record<string, unknown>, role: UIMessage['role'], index: number): string {
  const direct = pickNonEmptyString(record.id, record.messageId, record.message_id)
  if (direct) return direct

  const tsNum = typeof record.timestamp === 'number' ? record.timestamp : null
  const tsStr = typeof record.timestamp === 'string' && record.timestamp.trim() ? record.timestamp.trim() : null
  const hint = contentHashHint(record.content)
  if (tsNum != null) return `${role}:${tsNum}:${hint}`
  if (tsStr != null) return `${role}:${tsStr}:${hint}`

  return `${role}:${index}:${hint}`
}

function coerceContentBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean) as ContentBlock[]
}

function extractTextFromBlocks(blocks: ContentBlock[], rawContent?: unknown): string {
  if (typeof rawContent === 'string' && rawContent.trim()) {
    return rawContent
  }

  const parts: string[] = []
  for (const b of blocks) {
    const t = typeof b.type === 'string' ? b.type.toLowerCase() : ''
    const canUseTextField =
      t === 'text' ||
      t === 'output_text' ||
      t === 'input_text' ||
      t === 'markdown' ||
      t === 'message' ||
      t === ''
    if (canUseTextField && typeof b.text === 'string' && b.text.trim()) {
      parts.push(b.text)
      continue
    }
    if (canUseTextField && typeof b.content === 'string' && b.content.trim()) {
      parts.push(b.content)
      continue
    }
    if (canUseTextField && typeof b.value === 'string' && b.value.trim()) {
      parts.push(b.value)
    }
  }
  return parts.join('\n')
}

function isToolCallBlock(block: ContentBlock): boolean {
  const t = typeof block.type === 'string' ? block.type.toLowerCase() : ''
  if (t === 'toolcall' || t === 'tool_call' || t === 'tooluse' || t === 'tool_use') return true
  return typeof block.name === 'string' && block.arguments != null
}

function isToolResultBlock(block: ContentBlock): boolean {
  const t = typeof block.type === 'string' ? block.type.toLowerCase() : ''
  return t === 'toolresult' || t === 'tool_result'
}

function extractToolResultText(block: ContentBlock): string | undefined {
  if (typeof block.text === 'string') return block.text
  if (typeof block.content === 'string') return block.content
  return undefined
}

export function openclawTranscriptToUIMessages(rawMessages: unknown): UIMessage[] {
  const input = Array.isArray(rawMessages) ? rawMessages : []
  const idSeenCount = new Map<string, number>()

  return input
    .map((m, idx): UIMessage | null => {
      if (!m || typeof m !== 'object') return null
      const record = m as Record<string, unknown>

      const roleRaw = typeof record.role === 'string' ? record.role : ''
      const role =
        roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : null
      if (!role) return null
      const rawMsgId = resolveStableMessageId(record, role, idx)
      const seenCount = idSeenCount.get(rawMsgId) ?? 0
      idSeenCount.set(rawMsgId, seenCount + 1)
      const msgId = seenCount === 0 ? rawMsgId : `${rawMsgId}:${seenCount + 1}`

      const contentBlocks = coerceContentBlocks(record.content)

      const parts: UIMessage['parts'] = []

      const text = extractTextFromBlocks(contentBlocks, record.content)
      if (text) {
        parts.push({ type: 'text', text })
      }

      // Best-effort: lift toolcall/toolresult blocks into dynamic-tool parts so UI can render cards.
      const toolCalls = contentBlocks.filter(isToolCallBlock)
      const toolResults = contentBlocks.filter(isToolResultBlock)

      if (toolCalls.length > 0 || toolResults.length > 0) {
        const baseToolCallId =
          typeof record.toolCallId === 'string' && record.toolCallId.trim()
            ? record.toolCallId.trim()
            : `${msgId}:tool`

        for (let i = 0; i < Math.max(toolCalls.length, 1); i += 1) {
          const call = toolCalls[i] ?? {}
          const callToolCallId = pickNonEmptyString(
            (call as Record<string, unknown>).toolCallId,
            (call as Record<string, unknown>).tool_call_id
          )
          const toolName =
            (typeof call.name === 'string' && call.name.trim()) ||
            (typeof record.toolName === 'string' && record.toolName.trim()) ||
            (typeof record.tool_name === 'string' && String(record.tool_name).trim()) ||
            'tool'

          const args = (call.arguments ?? call.args) as unknown
          const result = toolResults[i]
          const outText = result ? extractToolResultText(result) : undefined

          const toolCallId =
            callToolCallId ??
            (toolCalls.length > 1 ? `${baseToolCallId}-${i + 1}` : baseToolCallId)

          // Keep strict part typing: `output-available` requires an `output` field,
          // while `input-available` must not include it.
          if (outText) {
            parts.push({
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'output-available',
              input: args ?? {},
              output: outText,
              providerExecuted: true,
            })
          } else {
            parts.push({
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'input-available',
              input: args ?? {},
              providerExecuted: true,
            })
          }
        }
      }

      return {
        id: msgId,
        role,
        parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
      }
    })
    .filter((x): x is UIMessage => Boolean(x))
}
