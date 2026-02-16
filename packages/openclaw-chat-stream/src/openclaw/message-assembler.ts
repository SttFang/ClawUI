import type { UIMessageChunk } from 'ai'
import { computeSuffixDelta } from './delta'
import type { ApprovalRecovery } from './approval-recovery'

export interface MessageAssemblerCallbacks {
  enqueue(chunk: UIMessageChunk): void
}

export interface MessageAssembler {
  /** Apply a full-text snapshot (from chat.delta/final). */
  updateTextWithSnapshot(nextText: string): void
  /** Handle assistant stream text as a fallback source. */
  handleAssistantText(text: string, hasSeenChatEvent: boolean): void
  /** Lock to chat source: cancel any pending assistant fallback. */
  lockToChatSource(): void
  /** Close the current text part when a tool arrives. */
  closeTextForToolSplit(): void
  /** Ensure a text part is open (emits start-step + text-start if needed). */
  ensureTextStarted(): void
  /** Current accumulated text length. */
  readonly currentTextLength: number
  /** Current text part ID (for FinishPolicy). */
  readonly currentTextPartId: string
  /** Whether a text part is currently active/started. */
  readonly hasActiveTextPart: boolean
  /** Check if nextText is a continuation (superset) of the current text. */
  isContinuationOf(nextText: string): boolean
  dispose(): void
}

export function createMessageAssembler(
  approval: ApprovalRecovery,
  cb: MessageAssemblerCallbacks,
): MessageAssembler {
  let currentText = ''
  let didStartText = false
  let textPartCounter = 1
  let currentTextPartId = `text-${textPartCounter}`
  let toolSplitPending = false
  let toolSplitAt = -1
  let pendingAssistantText: string | null = null
  let assistantFallbackTimer: ReturnType<typeof setTimeout> | null = null

  const startPostToolTextPart = () => {
    textPartCounter++
    currentTextPartId = `text-${textPartCounter}`
    didStartText = true
    toolSplitPending = false
    cb.enqueue({ type: 'text-start', id: currentTextPartId })
  }

  const ensureTextStarted = () => {
    if (didStartText) return
    didStartText = true
    cb.enqueue({ type: 'start-step' })
    cb.enqueue({ type: 'text-start', id: currentTextPartId })
  }

  return {
    get currentTextLength() {
      return currentText.length
    },
    get currentTextPartId() {
      return currentTextPartId
    },
    get hasActiveTextPart() {
      return didStartText
    },

    ensureTextStarted,

    isContinuationOf(nextText: string) {
      if (!currentText) return false
      return nextText.length >= currentText.length && nextText.startsWith(currentText)
    },

    closeTextForToolSplit() {
      if (!didStartText || toolSplitPending) return
      cb.enqueue({ type: 'text-end', id: currentTextPartId })
      didStartText = false
      toolSplitPending = true
      toolSplitAt = currentText.length
    },

    updateTextWithSnapshot(nextText: string) {
      if (!nextText) return
      if (toolSplitPending && nextText.length > toolSplitAt) {
        startPostToolTextPart()
      }
      if (!currentText) {
        ensureTextStarted()
        currentText = nextText
        cb.enqueue({ type: 'text-delta', id: currentTextPartId, delta: nextText })
        return
      }
      if (nextText.length < currentText.length) return
      ensureTextStarted()
      const delta = computeSuffixDelta(currentText, nextText)
      currentText = nextText
      if (delta) cb.enqueue({ type: 'text-delta', id: currentTextPartId, delta })
    },

    lockToChatSource() {
      if (assistantFallbackTimer) {
        clearTimeout(assistantFallbackTimer)
        assistantFallbackTimer = null
      }
      pendingAssistantText = null
    },

    handleAssistantText(text: string, hasSeenChatEvent: boolean) {
      pendingAssistantText = text
      if (assistantFallbackTimer) clearTimeout(assistantFallbackTimer)
      assistantFallbackTimer = setTimeout(() => {
        assistantFallbackTimer = null
        if (!pendingAssistantText) return
        if (hasSeenChatEvent) return

        const fallbackText = pendingAssistantText
        pendingAssistantText = null

        if (!currentText) {
          ensureTextStarted()
          currentText = fallbackText
          cb.enqueue({ type: 'text-delta', id: currentTextPartId, delta: fallbackText })
          return
        }

        if (fallbackText.startsWith(currentText)) {
          const delta = computeSuffixDelta(currentText, fallbackText)
          currentText = fallbackText
          if (delta) cb.enqueue({ type: 'text-delta', id: currentTextPartId, delta })
          return
        }

        const normalizedFallbackText = fallbackText.trim()
        if (!normalizedFallbackText) return

        const canAppendDivergentText =
          (approval.hasRecentApprovalActivity() || approval.hasRecentToolTerminalActivity()) &&
          !currentText.includes(normalizedFallbackText)
        if (canAppendDivergentText) {
          const separator = currentText.endsWith('\n') ? '\n' : '\n\n'
          currentText = `${currentText}${separator}${normalizedFallbackText}`
          cb.enqueue({ type: 'text-delta', id: currentTextPartId, delta: `${separator}${normalizedFallbackText}` })
          return
        }
      }, 300)
    },

    dispose() {
      if (assistantFallbackTimer) {
        clearTimeout(assistantFallbackTimer)
        assistantFallbackTimer = null
      }
    },
  }
}
