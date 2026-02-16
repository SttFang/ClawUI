import type { UIMessage } from 'ai'

import { normalizeToolCallId, resolveToolCallId } from '@clawui/types/tool-call'

export type ContentBlock = Record<string, unknown> & { type?: unknown }
export const EXEC_NO_OUTPUT_TEXT = 'No output - tool completed successfully.'

export function pickNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export function contentHashHint(content: unknown): string {
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

export function resolveStableMessageId(record: Record<string, unknown>, role: UIMessage['role'], index: number): string {
  const direct = pickNonEmptyString(record.id, record.messageId, record.message_id)
  if (direct) return direct

  const tsNum = typeof record.timestamp === 'number' ? record.timestamp : null
  const tsStr = typeof record.timestamp === 'string' && record.timestamp.trim() ? record.timestamp.trim() : null
  const hint = contentHashHint(record.content)
  if (tsNum != null) return `${role}:${tsNum}:${hint}`
  if (tsStr != null) return `${role}:${tsStr}:${hint}`

  return `${role}:${index}:${hint}`
}

export function coerceContentBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return []
  return value.filter(Boolean) as ContentBlock[]
}

export function extractTextFromBlocks(blocks: ContentBlock[], rawContent?: unknown): string {
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

export function isToolCallBlock(block: ContentBlock): boolean {
  const t = typeof block.type === 'string' ? block.type.toLowerCase() : ''
  if (t === 'toolcall' || t === 'tool_call' || t === 'tooluse' || t === 'tool_use') return true
  return typeof block.name === 'string' && block.arguments != null
}

export function isToolResultBlock(block: ContentBlock): boolean {
  const t = typeof block.type === 'string' ? block.type.toLowerCase() : ''
  return t === 'toolresult' || t === 'tool_result' || t === 'tool_result_error'
}

function extractTextFromMixedContent(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (!Array.isArray(value)) return null

  const parts: string[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const t = typeof record.type === 'string' ? record.type.toLowerCase() : ''
    if ((t === 'text' || t === 'output_text' || t === 'input_text' || t === '') && typeof record.text === 'string') {
      if (record.text.trim()) parts.push(record.text)
      continue
    }
    if (typeof record.content === 'string' && record.content.trim()) {
      parts.push(record.content)
    }
  }

  if (parts.length === 0) return null
  return parts.join('\n')
}

export function extractToolResultOutput(block: ContentBlock): unknown {
  if (typeof block.text === 'string') return block.text
  if (typeof block.content === 'string') return block.content
  if (typeof block.result === 'string') return block.result
  if (typeof block.output === 'string') return block.output
  if (block.result != null) return block.result
  if (block.output != null) return block.output
  if (block.content != null) {
    const textFromContent = extractTextFromMixedContent(block.content)
    if (textFromContent) return textFromContent
  }
  return undefined
}

export function resolveMessageToolCallId(record: Record<string, unknown>, msgId: string): string {
  const fromCanonical = resolveToolCallId(record)
  if (fromCanonical) return fromCanonical

  const extraFallback = pickNonEmptyString(
    record.runId,
    record.run_id,
    record.clientRunId,
    record.client_run_id,
  )
  if (extraFallback) return normalizeToolCallId(extraFallback)

  return normalizeToolCallId(`${msgId}:tool`)
}

export function resolveMessageToolName(record: Record<string, unknown>): string {
  return (
    pickNonEmptyString(record.toolName, record.tool_name, record.name, record.tool) ?? 'tool'
  )
}

export function extractMessageToolOutput(record: Record<string, unknown>): unknown {
  if (record.result != null) return record.result
  if (record.output != null) return record.output
  if (typeof record.content === 'string' && record.content.trim()) return record.content
  if (typeof record.text === 'string' && record.text.trim()) return record.text

  const content = record.content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') continue
      const result = extractToolResultOutput(item as ContentBlock)
      if (typeof result !== 'undefined') return result
    }
  }

  return undefined
}

export function extractMessageToolInput(record: Record<string, unknown>): unknown {
  if (record.arguments != null) return record.arguments
  if (record.args != null) return record.args
  if (record.input != null) return record.input
  return undefined
}

export function maybeAddExecFallbackOutput(toolName: string, output: unknown): unknown {
  if (typeof output !== 'undefined') return output
  const normalizedToolName = toolName.trim().toLowerCase()
  if (normalizedToolName === 'exec' || normalizedToolName === 'bash') {
    return EXEC_NO_OUTPUT_TEXT
  }
  return undefined
}

export function normalizeMessageRole(rawRole: string): UIMessage['role'] | null {
  if (rawRole === 'user' || rawRole === 'assistant' || rawRole === 'system') return rawRole
  if (rawRole === 'tool' || rawRole === 'toolresult' || rawRole === 'tool_result') {
    return 'assistant'
  }
  return null
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function stringifyOutputForCompare(output: unknown): string {
  if (typeof output === 'string') return normalizeComparableText(output)
  if (typeof output === 'number' || typeof output === 'boolean') {
    return normalizeComparableText(String(output))
  }
  if (output == null) return ''
  try {
    return normalizeComparableText(JSON.stringify(output))
  } catch {
    return normalizeComparableText(String(output))
  }
}

export function isLikelyToolReceiptText(text: string): boolean {
  const normalized = normalizeComparableText(text)
  if (!normalized) return false
  return (
    normalized.startsWith('system:') ||
    normalized.startsWith('approval required') ||
    normalized.startsWith('approve to run') ||
    normalized.startsWith('exec finished') ||
    normalized.startsWith('exec denied') ||
    normalized.startsWith('enoent:') ||
    (normalized.startsWith('{') && normalized.includes('"status"') && normalized.includes('"tool"'))
  )
}

const METADATA_HEADER_RE =
  /^(?:conversation info|sender|thread starter|replied message|forwarded message|chat history)\s*\(/i

const TIMESTAMP_RE =
  /\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+GMT[+-]\d{1,2})?\]\s*/i

export function stripUserMetadataPrefix(text: string): string {
  const trimmed = text.trim()
  if (!METADATA_HEADER_RE.test(trimmed)) return trimmed

  let lastTimestampEnd = -1
  const re = new RegExp(TIMESTAMP_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(trimmed)) !== null) {
    lastTimestampEnd = match.index + match[0].length
  }
  if (lastTimestampEnd > 0 && lastTimestampEnd < trimmed.length) {
    return trimmed.slice(lastTimestampEnd).trim()
  }

  return trimmed
}

export function shouldKeepTextAlongsideToolParts(text: string, toolOutputs: unknown[]): boolean {
  const normalizedText = normalizeComparableText(text)
  if (!normalizedText) return false
  if (isLikelyToolReceiptText(normalizedText)) return false

  for (const output of toolOutputs) {
    const normalizedOutput = stringifyOutputForCompare(output)
    if (!normalizedOutput) continue
    if (normalizedText === normalizedOutput) return false
    if (normalizedText.includes(normalizedOutput) || normalizedOutput.includes(normalizedText)) {
      return false
    }
  }

  return true
}

function readInternalProvenanceKind(record: Record<string, unknown>): string {
  const candidates = [
    record.inputProvenance,
    record.provenance,
    typeof record.meta === 'object' && record.meta
      ? (record.meta as Record<string, unknown>).inputProvenance
      : null,
    typeof record.metadata === 'object' && record.metadata
      ? (record.metadata as Record<string, unknown>).inputProvenance
      : null,
    record.meta,
    record.metadata,
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const kind = (candidate as Record<string, unknown>).kind
    if (typeof kind === 'string' && kind.trim()) return kind.trim().toLowerCase()
  }
  return ''
}

export function shouldSkipInternalSystemUser(record: Record<string, unknown>, role: UIMessage['role']): boolean {
  if (role !== 'user') return false
  return readInternalProvenanceKind(record) === 'internal_system'
}
