import type { UIMessage } from 'ai'

import { normalizeToolCallId } from '@clawui/types/tool-call'

import {
  coerceContentBlocks,
  extractMessageToolInput,
  extractMessageToolOutput,
  extractTextFromBlocks,
  extractToolResultOutput,
  isLikelyToolReceiptText,
  isToolCallBlock,
  isToolResultBlock,
  maybeAddExecFallbackOutput,
  normalizeMessageRole,
  pickNonEmptyString,
  resolveMessageToolCallId,
  resolveMessageToolName,
  resolveStableMessageId,
  shouldKeepTextAlongsideToolParts,
  shouldSkipInternalSystemUser,
  stripUserMetadataPrefix,
} from './content-helpers'
import { bindToolCallLifecycles, filterEmptyUserMessages, mergeAdjacentToolMessages } from './tool-lifecycle'

export { normalizeToolCallId }

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
