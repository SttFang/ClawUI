import type { UIMessage } from 'ai'

export function extractUserText(message: UIMessage | undefined): string | null {
  if (!message) return null
  if (message.role !== 'user') return null
  for (let i = message.parts.length - 1; i >= 0; i -= 1) {
    const part = message.parts[i]
    if (part.type === 'text' && typeof part.text === 'string') {
      const text = part.text.trim()
      if (text) return text
    }
  }
  return null
}
