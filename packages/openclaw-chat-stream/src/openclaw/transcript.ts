import type { UIMessage } from 'ai'
import {
  isSyntheticToolCallId,
  isInputState,
  isOutputState,
  normalizeToolCallId,
  resolveToolCallId,
  toolStatePriority,
} from '@clawui/types/tool-call'

export { normalizeToolCallId }

type ContentBlock = Record<string, unknown> & { type?: unknown }
const EXEC_NO_OUTPUT_TEXT = 'No output - tool completed successfully.'

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

function extractToolResultOutput(block: ContentBlock): unknown {
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

function resolveMessageToolCallId(record: Record<string, unknown>, msgId: string): string {
  // resolveToolCallId covers toolCallId/tool_call_id/toolUseId/tool_use_id/toolId/id.
  // For transcript context, also try runId/run_id/clientRunId/client_run_id as fallbacks.
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

function resolveMessageToolName(record: Record<string, unknown>): string {
  return (
    pickNonEmptyString(record.toolName, record.tool_name, record.name, record.tool) ?? 'tool'
  )
}

function extractMessageToolOutput(record: Record<string, unknown>): unknown {
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

function extractMessageToolInput(record: Record<string, unknown>): unknown {
  if (record.arguments != null) return record.arguments
  if (record.args != null) return record.args
  if (record.input != null) return record.input
  return undefined
}

function maybeAddExecFallbackOutput(toolName: string, output: unknown): unknown {
  if (typeof output !== 'undefined') return output
  const normalizedToolName = toolName.trim().toLowerCase()
  if (normalizedToolName === 'exec' || normalizedToolName === 'bash') {
    return EXEC_NO_OUTPUT_TEXT
  }
  return undefined
}

function normalizeMessageRole(rawRole: string): UIMessage['role'] | null {
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

function isLikelyToolReceiptText(text: string): boolean {
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

function stripUserMetadataPrefix(text: string): string {
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

function shouldKeepTextAlongsideToolParts(text: string, toolOutputs: unknown[]): boolean {
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

function shouldSkipInternalSystemUser(record: Record<string, unknown>, role: UIMessage['role']): boolean {
  if (role !== 'user') return false
  return readInternalProvenanceKind(record) === 'internal_system'
}

function normalizeToolInputForCompare(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input.trim()
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

function mergeToolParts(
  target: UIMessage,
  targetPart: Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>,
  source: UIMessage,
  sourcePart: Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>,
  sameCall: boolean,
): UIMessage {
  const keepSource = toolStatePriority(sourcePart.state) >= toolStatePriority(targetPart.state)
  if (!keepSource) return target
  const sourceInputStr = normalizeToolInputForCompare(sourcePart.input)
  const targetInputStr = normalizeToolInputForCompare(targetPart.input)
  const sourceInputEmpty = !sourceInputStr || sourceInputStr === '{}' || sourceInputStr === '[]'
  const targetInputEmpty = !targetInputStr || targetInputStr === '{}' || targetInputStr === '[]'
  const mergedInput = sourceInputEmpty && !targetInputEmpty ? targetPart.input : sourcePart.input
  return {
    ...source,
    parts: [
      {
        ...sourcePart,
        input: mergedInput,
        toolCallId: sameCall ? normalizeToolCallId(sourcePart.toolCallId) : sourcePart.toolCallId,
      },
    ],
  } as UIMessage
}

type DynamicToolPart = Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>

function getSingleDynamicToolPart(msg: UIMessage): DynamicToolPart | null {
  if (msg.role !== 'assistant' || msg.parts.length !== 1) return null
  const part = msg.parts[0]
  return part.type === 'dynamic-tool' ? part : null
}

function bindToolCallLifecycles(messages: UIMessage[]): UIMessage[] {
  // Pass 1: build toolCallId → { input, output } index map
  type Entry = { inputIdx: number; outputIdx: number }
  const bindings = new Map<string, Entry>()
  const boundInputs = new Set<number>()

  for (let i = 0; i < messages.length; i += 1) {
    const part = getSingleDynamicToolPart(messages[i])
    if (!part) continue
    const callId = normalizeToolCallId(part.toolCallId)
    const entry = bindings.get(callId) ?? { inputIdx: -1, outputIdx: -1 }

    if (isInputState(part.state)) {
      if (entry.inputIdx === -1 || toolStatePriority(part.state) > toolStatePriority(getSingleDynamicToolPart(messages[entry.inputIdx])!.state)) {
        entry.inputIdx = i
      }
    } else if (isOutputState(part.state)) {
      if (entry.outputIdx === -1 || toolStatePriority(part.state) > toolStatePriority(getSingleDynamicToolPart(messages[entry.outputIdx])!.state)) {
        entry.outputIdx = i
      }
    }

    bindings.set(callId, entry)
  }

  // Pass 2: merge paired input+output; mark outputs for deletion
  const deleteSet = new Set<number>()

  for (const [callId, { inputIdx, outputIdx }] of bindings) {
    if (inputIdx < 0 || outputIdx < 0 || inputIdx === outputIdx) continue
    const inputMsg = messages[inputIdx]
    const inputPart = getSingleDynamicToolPart(inputMsg)!
    const outputMsg = messages[outputIdx]
    const outputPart = getSingleDynamicToolPart(outputMsg)!
    messages[inputIdx] = mergeToolParts(inputMsg, inputPart, outputMsg, outputPart, !isSyntheticToolCallId(callId))
    deleteSet.add(outputIdx)
    boundInputs.add(inputIdx)
  }

  // Pass 3: fallback for unpaired outputs — match by (toolName + input) compatibility
  // Collect unbound inputs indexed by (toolName::normalizedInput)
  const unboundInputs: { idx: number; toolName: string; inputKey: string; synthetic: boolean }[] = []
  for (let i = 0; i < messages.length; i += 1) {
    if (deleteSet.has(i) || boundInputs.has(i)) continue
    const part = getSingleDynamicToolPart(messages[i])
    if (!part || !isInputState(part.state)) continue
    const callId = normalizeToolCallId(part.toolCallId)
    unboundInputs.push({
      idx: i,
      toolName: part.toolName.trim().toLowerCase(),
      inputKey: normalizeToolInputForCompare(part.input),
      synthetic: isSyntheticToolCallId(callId),
    })
  }

  // Collect unpaired outputs
  for (let i = 0; i < messages.length; i += 1) {
    if (deleteSet.has(i)) continue
    const part = getSingleDynamicToolPart(messages[i])
    if (!part || !isOutputState(part.state)) continue
    const callId = normalizeToolCallId(part.toolCallId)
    const entry = bindings.get(callId)
    if (entry && entry.inputIdx >= 0 && entry.outputIdx >= 0) continue

    const outputToolName = part.toolName.trim().toLowerCase()
    const outputInputStr = normalizeToolInputForCompare(part.input)
    const outputInputEmpty = !outputInputStr || outputInputStr === '{}' || outputInputStr === '[]'
    const outputSynthetic = isSyntheticToolCallId(callId)

    // Try exact (toolName + input) match
    let matchIdx = -1
    for (let j = 0; j < unboundInputs.length; j += 1) {
      const candidate = unboundInputs[j]
      if (candidate.toolName !== outputToolName) continue
      if (candidate.inputKey === outputInputStr) {
        matchIdx = j
        break
      }
    }

    // Try empty-output-input fallback: match by toolName alone when output has no input
    if (matchIdx < 0 && outputInputEmpty) {
      const sameToolCandidates = unboundInputs.filter(c => c.toolName === outputToolName)
      if (sameToolCandidates.length === 1) {
        matchIdx = unboundInputs.indexOf(sameToolCandidates[0])
      }
    }

    if (matchIdx < 0) continue
    // Require at least one side to have a synthetic ID (or empty output input for compat)
    const candidate = unboundInputs[matchIdx]
    if (!outputSynthetic && !candidate.synthetic && !outputInputEmpty) continue

    const inputMsg = messages[candidate.idx]
    const inputPart = getSingleDynamicToolPart(inputMsg)!
    messages[candidate.idx] = mergeToolParts(inputMsg, inputPart, messages[i], part, false)
    deleteSet.add(i)
    unboundInputs.splice(matchIdx, 1)
  }

  return messages.filter((_, i) => !deleteSet.has(i))
}

export function openclawTranscriptToUIMessages(rawMessages: unknown): UIMessage[] {
  const input = Array.isArray(rawMessages) ? rawMessages : []
  const idSeenCount = new Map<string, number>()

  const mapped = input
    .map((m, idx): UIMessage | null => {
      if (!m || typeof m !== 'object') return null
      const record = m as Record<string, unknown>

      const roleRaw = typeof record.role === 'string' ? record.role.toLowerCase() : ''
      const role = normalizeMessageRole(roleRaw)
      if (!role) return null
      if (shouldSkipInternalSystemUser(record, role)) return null

      const rawMsgId = resolveStableMessageId(record, role, idx)
      const seenCount = idSeenCount.get(rawMsgId) ?? 0
      idSeenCount.set(rawMsgId, seenCount + 1)
      const msgId = seenCount === 0 ? rawMsgId : `${rawMsgId}:${seenCount + 1}`

      const contentBlocks = coerceContentBlocks(record.content)

      if (role === 'user') {
        const text = extractTextFromBlocks(contentBlocks, record.content)
        if (isLikelyToolReceiptText(text)) return null
      }

      const parts: UIMessage['parts'] = []

      // Best-effort: lift toolcall/toolresult blocks into dynamic-tool parts so UI can render cards.
      const toolCalls = contentBlocks.filter(isToolCallBlock)
      const toolResults = contentBlocks.filter(isToolResultBlock)
      const hasToolRole = roleRaw === 'tool' || roleRaw === 'toolresult' || roleRaw === 'tool_result'

      if (toolCalls.length > 0 || toolResults.length > 0 || hasToolRole) {
        const baseToolCallId = resolveMessageToolCallId(record, msgId)
        const baseToolName = resolveMessageToolName(record)
        const messageToolOutput = extractMessageToolOutput(record)
        const messageToolInput = extractMessageToolInput(record)
        const iterations = Math.max(toolCalls.length, toolResults.length, hasToolRole ? 1 : 0)
        const toolOutputs: unknown[] = []

        for (let i = 0; i < iterations; i += 1) {
          const call = toolCalls[i] ?? {}
          const result = toolResults[i] ?? {}
          const callToolCallId = pickNonEmptyString(
            (call as Record<string, unknown>).toolCallId,
            (call as Record<string, unknown>).tool_call_id,
            (call as Record<string, unknown>).toolUseId,
            (call as Record<string, unknown>).tool_use_id,
            (call as Record<string, unknown>).id,
            (result as Record<string, unknown>).toolCallId,
            (result as Record<string, unknown>).tool_call_id,
            (result as Record<string, unknown>).toolUseId,
            (result as Record<string, unknown>).tool_use_id,
            (result as Record<string, unknown>).id
          )
          const toolName =
            (typeof call.name === 'string' && call.name.trim()) ||
            (typeof result.name === 'string' && result.name.trim()) ||
            (typeof record.toolName === 'string' && record.toolName.trim()) ||
            (typeof record.tool_name === 'string' && String(record.tool_name).trim()) ||
            baseToolName

          const resultRecord = result as Record<string, unknown>
          const resultInput = resultRecord.input ?? resultRecord.arguments ?? resultRecord.args
          const args = (call.arguments ?? call.args ?? resultInput ?? messageToolInput) as unknown
          const resultOutput = extractToolResultOutput(result)
          const isToolResultLike = toolResults.length > 0 || hasToolRole
          const maybeOutput = i === 0 ? resultOutput ?? messageToolOutput : resultOutput
          const output = isToolResultLike ? maybeAddExecFallbackOutput(toolName, maybeOutput) : undefined
          if (typeof output !== 'undefined') toolOutputs.push(output)

          const toolCallId = normalizeToolCallId(
            callToolCallId ??
              (toolCalls.length > 1 ? `${baseToolCallId}-${i + 1}` : baseToolCallId)
          )

          // Keep strict part typing: `output-available` requires an `output` field,
          // while `input-available` must not include it.
          if (typeof output !== 'undefined') {
            parts.push({
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'output-available',
              input: args ?? {},
              output,
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

        const text = extractTextFromBlocks(contentBlocks, record.content)
        if (text && shouldKeepTextAlongsideToolParts(text, toolOutputs)) {
          parts.unshift({ type: 'text', text })
        }
      } else {
        let text = extractTextFromBlocks(contentBlocks, record.content)
        if (!text && role === 'user') {
          text = pickNonEmptyString(record.text, record.message) ?? ''
        }
        if (role === 'user') text = stripUserMetadataPrefix(text)
        if (text) {
          parts.push({ type: 'text', text })
        }
      }

      return {
        id: msgId,
        role,
        parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
      }
    })
    .filter((x): x is UIMessage => Boolean(x))

  return mergeAdjacentToolMessages(bindToolCallLifecycles(filterEmptyUserMessages(mapped)))
}

function isEmptyUserMessage(msg: UIMessage): boolean {
  if (msg.role !== 'user') return false
  return msg.parts.every(p => p.type !== 'text' || !p.text.trim())
}

function filterEmptyUserMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(m => !isEmptyUserMessage(m))
}

function mergeAdjacentToolMessages(messages: UIMessage[]): UIMessage[] {
  const result: UIMessage[] = []
  for (const current of messages) {
    const last = result[result.length - 1]
    if (
      last &&
      last.role === 'assistant' &&
      current.role === 'assistant' &&
      last.parts.every(p => p.type === 'dynamic-tool') &&
      current.parts.every(p => p.type === 'dynamic-tool')
    ) {
      result[result.length - 1] = { ...last, parts: [...last.parts, ...current.parts] } as UIMessage
      continue
    }
    result.push(current)
  }
  return result
}
