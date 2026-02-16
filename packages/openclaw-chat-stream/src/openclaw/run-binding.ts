import type { OpenClawAgentEventPayload, OpenClawChatEvent } from './types'
import type { ApprovalRecovery } from './approval-recovery'

const CHAT_ALIAS_GRACE_MS = 250

export interface RunBindingContext {
  currentTextLength: () => number
  isContinuationSnapshot: (evt: OpenClawChatEvent) => boolean
  isFinished: () => boolean
  onDeferredChatEvent: (evt: OpenClawChatEvent) => void
}

export interface RunBinding {
  setClientRunId(runId: string): void
  setStreamStartedAt(ts: number): void
  processChatRunId(evt: OpenClawChatEvent): 'accept' | 'defer' | 'drop'
  processAgentRunId(params: {
    rid: string
    stream: OpenClawAgentEventPayload['stream']
    seq?: number
    phase?: string
  }): boolean
  isCurrentAgentRun(rid: string): boolean
  markClientChatSeen(): void
  clearPendingChatAlias(): void
  isStaleAgentEvent(ts: unknown): boolean
  readonly clientRunId: string | null
  readonly hasSeenClientChatEvent: boolean
  dispose(): void
}

export function createRunBinding(
  approval: ApprovalRecovery,
  ctx: RunBindingContext,
): RunBinding {
  let clientRunId: string | null = null
  let boundChatRunId: string | null = null
  let boundAgentRunId: string | null = null
  let hasSeenClientChatEvent = false
  let streamStartedAt = 0
  let pendingChatAliasTimer: ReturnType<typeof setTimeout> | null = null
  let pendingChatAliasRunId: string | null = null
  let pendingChatAliasEvent: OpenClawChatEvent | null = null

  const clearPendingChatAlias = () => {
    if (pendingChatAliasTimer) {
      clearTimeout(pendingChatAliasTimer)
      pendingChatAliasTimer = null
    }
    pendingChatAliasRunId = null
    pendingChatAliasEvent = null
  }

  const isCurrentChatRun = (rid: string) => {
    if (clientRunId != null && rid === clientRunId) return true
    return boundChatRunId != null && rid === boundChatRunId
  }

  const queuePendingChatAlias = (evt: OpenClawChatEvent) => {
    if (!clientRunId) return
    if (evt.runId === clientRunId) return
    const isApprovalActive = approval.hasRecentApprovalActivity()
    const continuationSnapshot = ctx.isContinuationSnapshot(evt)
    if (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) return
    if (ctx.isFinished()) return
    if (boundChatRunId) return
    if (ctx.currentTextLength() > 0 && !isApprovalActive && !continuationSnapshot) return
    if (evt.state !== 'delta' && evt.state !== 'final') return

    pendingChatAliasRunId = evt.runId
    pendingChatAliasEvent = evt
    if (pendingChatAliasTimer) return
    pendingChatAliasTimer = setTimeout(() => {
      pendingChatAliasTimer = null
      const queuedRunId = pendingChatAliasRunId
      const queuedEvent = pendingChatAliasEvent
      pendingChatAliasRunId = null
      pendingChatAliasEvent = null
      if (!queuedRunId || !queuedEvent) return
      const isApprovalActive = approval.hasRecentApprovalActivity()
      const continuationSnapshot = ctx.isContinuationSnapshot(queuedEvent)
      if (
        (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) ||
        ctx.isFinished() ||
        boundChatRunId ||
        (ctx.currentTextLength() > 0 && !isApprovalActive && !continuationSnapshot)
      ) {
        return
      }

      boundChatRunId = queuedRunId
      ctx.onDeferredChatEvent(queuedEvent)
    }, CHAT_ALIAS_GRACE_MS)
  }

  const maybeBindChatRunId = (evt: OpenClawChatEvent) => {
    if (!clientRunId) return
    if (!evt.runId || evt.runId === clientRunId) return
    if (boundChatRunId) return
    const isApprovalActive = approval.hasRecentApprovalActivity()
    const continuationSnapshot = ctx.isContinuationSnapshot(evt)
    if (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) return
    if (ctx.isFinished()) return
    if (ctx.currentTextLength() > 0 && !isApprovalActive && !continuationSnapshot) return
    const elapsed = streamStartedAt > 0 ? Date.now() - streamStartedAt : 0
    const allowDelayedBind = elapsed >= 30_000
    const canTrustAliasWithoutGrace =
      (boundAgentRunId != null && evt.runId === boundAgentRunId) ||
      isApprovalActive ||
      allowDelayedBind
    if (!canTrustAliasWithoutGrace && evt.state !== 'final') return
    if (evt.state !== 'delta' && evt.state !== 'final') return
    boundChatRunId = evt.runId
  }

  const maybeBindAgentRunId = (params: {
    rid: string
    stream: OpenClawAgentEventPayload['stream']
    seq?: number
    phase?: string
  }) => {
    const { rid, stream, phase, seq } = params
    if (!rid || !clientRunId) return
    if (rid === clientRunId) return
    if (boundAgentRunId) return
    const isApprovalActive = approval.hasRecentApprovalActivity()
    if (hasSeenClientChatEvent && !isApprovalActive) return
    const elapsed = streamStartedAt > 0 ? Date.now() - streamStartedAt : 0
    const likelyFreshSeq = typeof seq === 'number' ? seq <= 12 : true
    const allowDelayedBind = elapsed >= 30_000
    if (!likelyFreshSeq && !allowDelayedBind && !isApprovalActive) return

    const normalizedPhase = typeof phase === 'string' ? phase : ''
    const canBindFromLifecycle =
      stream === 'lifecycle' &&
      (normalizedPhase === 'start' || normalizedPhase === 'bootstrap' || !normalizedPhase)
    const canBindFromTool =
      stream === 'tool' && (normalizedPhase === 'start' || normalizedPhase === 'update')

    if (!canBindFromLifecycle && !canBindFromTool) return
    boundAgentRunId = rid
  }

  return {
    get clientRunId() {
      return clientRunId
    },
    get hasSeenClientChatEvent() {
      return hasSeenClientChatEvent
    },

    setClientRunId(runId: string) {
      clientRunId = runId
    },
    setStreamStartedAt(ts: number) {
      streamStartedAt = ts
    },

    markClientChatSeen() {
      hasSeenClientChatEvent = true
    },

    clearPendingChatAlias,

    isStaleAgentEvent(ts: unknown) {
      if (typeof ts !== 'number') return false
      if (!Number.isFinite(ts)) return false
      if (streamStartedAt <= 0) return false
      return ts + 1000 < streamStartedAt
    },

    processChatRunId(evt: OpenClawChatEvent): 'accept' | 'defer' | 'drop' {
      if (clientRunId && evt.runId === clientRunId) {
        clearPendingChatAlias()
      }
      maybeBindChatRunId(evt)
      if (!isCurrentChatRun(evt.runId)) {
        queuePendingChatAlias(evt)
        return 'defer'
      }
      clearPendingChatAlias()
      return 'accept'
    },

    processAgentRunId(params) {
      maybeBindAgentRunId(params)
      return this.isCurrentAgentRun(params.rid)
    },

    isCurrentAgentRun(rid: string) {
      if (clientRunId == null) return false
      if (rid === clientRunId) return true
      return boundAgentRunId != null && rid === boundAgentRunId
    },

    dispose() {
      clearPendingChatAlias()
    },
  }
}
