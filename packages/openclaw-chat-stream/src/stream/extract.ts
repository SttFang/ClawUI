export function extractOpenClawTextFromMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) return null
  const first = content[0] as { type?: unknown; text?: unknown } | undefined
  if (!first || typeof first !== 'object') return null
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text : null
}

export function extractIsReasoningFromMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false
  return (message as { isReasoning?: unknown }).isReasoning === true
}

