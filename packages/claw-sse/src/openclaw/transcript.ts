import type { UIMessage } from 'ai'

function createId(prefix: string): string {
  const rand = (globalThis.crypto as { randomUUID?: () => string } | undefined)?.randomUUID?.()
  return `${prefix}-${rand ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

type ContentBlock = Record<string, unknown> & { type?: unknown }

function coerceContentBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean) as ContentBlock[]
}

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    const t = typeof b.type === 'string' ? b.type.toLowerCase() : ''
    if (t === 'text' && typeof b.text === 'string' && b.text.trim()) {
      parts.push(b.text)
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

  return input
    .map((m): UIMessage | null => {
      if (!m || typeof m !== 'object') return null
      const record = m as Record<string, unknown>

      const roleRaw = typeof record.role === 'string' ? record.role : ''
      const role =
        roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : null
      if (!role) return null

      const contentBlocks = coerceContentBlocks(record.content)

      const parts: UIMessage['parts'] = []

      const text = extractTextFromBlocks(contentBlocks)
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
            : createId('tool')

        for (let i = 0; i < Math.max(toolCalls.length, 1); i += 1) {
          const call = toolCalls[i] ?? {}
          const toolName =
            (typeof call.name === 'string' && call.name.trim()) ||
            (typeof record.toolName === 'string' && record.toolName.trim()) ||
            (typeof record.tool_name === 'string' && String(record.tool_name).trim()) ||
            'tool'

          const args = (call.arguments ?? call.args) as unknown
          const result = toolResults[i]
          const outText = result ? extractToolResultText(result) : undefined

          parts.push({
            type: 'dynamic-tool',
            toolName,
            toolCallId: toolCalls.length > 1 ? `${baseToolCallId}-${i + 1}` : baseToolCallId,
            state: outText ? 'output-available' : 'input-available',
            input: args ?? {},
            ...(outText ? { output: outText } : {}),
            dynamic: true,
            providerExecuted: true,
          })
        }
      }

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id : createId(role),
        role,
        parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
      }
    })
    .filter((x): x is UIMessage => Boolean(x))
}

