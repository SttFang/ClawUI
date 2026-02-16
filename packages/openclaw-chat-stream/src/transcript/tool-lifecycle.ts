import type { UIMessage } from 'ai'

import {
  isSyntheticToolCallId,
  isInputState,
  isOutputState,
  normalizeToolCallId,
  toolStatePriority,
} from '@clawui/types/tool-call'

function normalizeToolInputForCompare(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input.trim()
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

type DynamicToolPart = Extract<UIMessage['parts'][number], { type: 'dynamic-tool' }>

function mergeToolParts(
  target: UIMessage,
  targetPart: DynamicToolPart,
  source: UIMessage,
  sourcePart: DynamicToolPart,
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

function getSingleDynamicToolPart(msg: UIMessage): DynamicToolPart | null {
  if (msg.role !== 'assistant' || msg.parts.length !== 1) return null
  const part = msg.parts[0]
  return part.type === 'dynamic-tool' ? part : null
}

export function bindToolCallLifecycles(messages: UIMessage[]): UIMessage[] {
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

    let matchIdx = -1
    for (let j = 0; j < unboundInputs.length; j += 1) {
      const candidate = unboundInputs[j]
      if (candidate.toolName !== outputToolName) continue
      if (candidate.inputKey === outputInputStr) {
        matchIdx = j
        break
      }
    }

    if (matchIdx < 0 && outputInputEmpty) {
      const sameToolCandidates = unboundInputs.filter(c => c.toolName === outputToolName)
      if (sameToolCandidates.length === 1) {
        matchIdx = unboundInputs.indexOf(sameToolCandidates[0])
      }
    }

    if (matchIdx < 0) continue
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

export function filterEmptyUserMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(m => {
    if (m.role !== 'user') return true
    return m.parts.some(p => p.type === 'text' && p.text.trim())
  })
}

export function mergeAdjacentToolMessages(messages: UIMessage[]): UIMessage[] {
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
