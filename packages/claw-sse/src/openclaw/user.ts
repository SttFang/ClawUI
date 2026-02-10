import type { UIMessage } from 'ai'

export function extractUserText(message: UIMessage | undefined): string | null {
  if (!message) return null
  if (message.role !== 'user') return null
  for (const part of message.parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      return part.text
    }
  }
  return null
}

