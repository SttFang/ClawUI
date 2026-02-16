import type { UIMessageChunk } from 'ai'

export interface FinishPolicyCallbacks {
  /** Whether there's an active text part that needs closing. */
  hasActiveTextPart(): boolean
  /** ID of the active text part. */
  activeTextPartId(): string
  /** Cancel any pending timers external to FinishPolicy (assistant fallback, chat alias). */
  cancelExternalTimers(): void
  /** Unsubscribe from gateway events. */
  unsubscribe(): void
  /** Enqueue a chunk to the ReadableStream controller. */
  enqueue(chunk: UIMessageChunk): void
  /** Close the ReadableStream controller. */
  closeController(): void
}

export interface FinishPolicy {
  onChatDeltaOrFinal(): void
  onChatFinal(): void
  onChatAborted(reason?: string): void
  onChatError(errorText: string): void
  onLifecycleEnd(): void
  onLifecycleError(errorText: string): void
  onUserAbort(abortChat: () => void): void
  onInitError(errorText: string): void
  addPendingTool(toolCallId: string): void
  removePendingTool(toolCallId: string): void
  readonly isFinished: boolean
  readonly isClosed: boolean
  readonly hasPendingTools: boolean
  readonly clientRunId: string | null
  setClientRunId(runId: string): void
  dispose(): void
}

export function createFinishPolicy(callbacks: FinishPolicyCallbacks): FinishPolicy {
  let didFinish = false
  let closed = false
  let clientRunId: string | null = null
  let lifecycleFinishTimer: ReturnType<typeof setTimeout> | null = null
  let lastChatEventAt = 0
  let lifecycleEndAt = 0
  const pendingToolCalls = new Set<string>()

  const clearTimers = () => {
    if (lifecycleFinishTimer) {
      clearTimeout(lifecycleFinishTimer)
      lifecycleFinishTimer = null
    }
    callbacks.cancelExternalTimers()
  }

  const closeOnce = () => {
    if (closed) return
    closed = true
    callbacks.unsubscribe()
    clearTimers()
    callbacks.closeController()
  }

  const failOnce = (errorText: string) => {
    if (closed) return
    closed = true
    callbacks.unsubscribe()
    clearTimers()
    callbacks.enqueue({ type: 'error', errorText })
    callbacks.closeController()
  }

  const finishOnce = (opts?: { kind?: 'ok' | 'abort'; reason?: string }) => {
    if (didFinish) return
    didFinish = true
    clearTimers()
    if (callbacks.hasActiveTextPart()) {
      callbacks.enqueue({ type: 'text-end', id: callbacks.activeTextPartId() })
    }
    callbacks.enqueue({ type: 'finish-step' })
    if (opts?.kind === 'abort') {
      callbacks.enqueue({ type: 'abort', reason: opts.reason })
      callbacks.enqueue({ type: 'finish', finishReason: 'stop' })
    } else {
      callbacks.enqueue({ type: 'finish' })
    }
    closeOnce()
  }

  const scheduleLifecycleFinish = () => {
    if (lifecycleFinishTimer) return
    lifecycleEndAt = lifecycleEndAt || Date.now()
    lifecycleFinishTimer = setTimeout(() => {
      lifecycleFinishTimer = null

      if (pendingToolCalls.size > 0) {
        scheduleLifecycleFinish()
        return
      }

      const now = Date.now()
      const idleForMs = lastChatEventAt > 0 ? now - lastChatEventAt : now - lifecycleEndAt
      const sinceEndMs = now - lifecycleEndAt

      if (lastChatEventAt > 0 && idleForMs < 800) {
        scheduleLifecycleFinish()
        return
      }

      if (sinceEndMs < 20_000) {
        scheduleLifecycleFinish()
        return
      }

      finishOnce()
    }, 1500)
  }

  return {
    get isFinished() {
      return didFinish
    },
    get isClosed() {
      return closed
    },
    get hasPendingTools() {
      return pendingToolCalls.size > 0
    },
    get clientRunId() {
      return clientRunId
    },
    setClientRunId(runId: string) {
      clientRunId = runId
    },

    onChatDeltaOrFinal() {
      lastChatEventAt = Date.now()
      if (lifecycleFinishTimer) {
        clearTimeout(lifecycleFinishTimer)
        lifecycleFinishTimer = null
      }
    },

    onChatFinal() {
      finishOnce()
    },
    onChatAborted(reason?: string) {
      finishOnce({ kind: 'abort', reason: reason ?? 'aborted' })
    },
    onChatError(errorText: string) {
      failOnce(errorText)
    },
    onLifecycleEnd() {
      scheduleLifecycleFinish()
    },
    onLifecycleError(errorText: string) {
      failOnce(errorText)
    },
    onUserAbort(abortChat: () => void) {
      if (!clientRunId) {
        finishOnce({ kind: 'abort', reason: 'aborted' })
        return
      }
      abortChat()
      finishOnce({ kind: 'abort', reason: 'aborted' })
    },
    onInitError(errorText: string) {
      failOnce(errorText)
    },

    addPendingTool(toolCallId: string) {
      pendingToolCalls.add(toolCallId)
    },
    removePendingTool(toolCallId: string) {
      pendingToolCalls.delete(toolCallId)
    },

    dispose() {
      clearTimers()
    },
  }
}
