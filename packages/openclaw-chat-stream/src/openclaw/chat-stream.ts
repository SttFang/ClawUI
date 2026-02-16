import type { UIMessage, UIMessageChunk } from 'ai'

import { computeSuffixDelta } from './delta'
import { extractOpenClawTextFromMessage } from './extract'
import { resolveToolCallId } from '@clawui/types/tool-call'
import { extractUserText } from './user'
import { createApprovalRecovery } from './approval-recovery'
import type {
  GatewayEventFrame,
  OpenClawAgentEventPayload,
  OpenClawChatEvent,
  OpenClawLifecycleEventData,
  OpenClawToolEventData,
} from './types'
import type { OpenClawChatTransportAdapter } from './chat-adapter'

export function createOpenClawChatStream(params: {
  sessionKey: string
  adapter: OpenClawChatTransportAdapter
  messages: UIMessage[]
  abortSignal?: AbortSignal
  trigger?: string
}): ReadableStream<UIMessageChunk> {
  const { sessionKey, adapter, messages, abortSignal, trigger } = params

  const last = messages[messages.length - 1]
  const latestUserText = extractUserText(last)
  const fallbackUserText =
    trigger === 'regenerate-message'
      ? extractUserText([...messages].reverse().find((m) => m.role === 'user'))
      : null
  const userText = latestUserText ?? fallbackUserText
  if (!userText) {
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: 'error', errorText: 'missing user message' })
        controller.close()
      },
    })
  }

  // v1 only: regenerate uses the latest user message text.
  if (trigger === 'regenerate-message') {
    // no-op; keep behavior identical for now
  }

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      // run 绑定策略（OpenClaw v2026）:
      // - `chat` 事件只按 clientRunId 处理，避免跨 run 串包。
      // - `agent` 事件允许早期绑定一次内部 runId（用于 tool/lifecycle 展示）。
      let clientRunId: string | null = null
      let boundChatRunId: string | null = null
      let boundAgentRunId: string | null = null
      let closed = false
      let currentText = ''
      let didStartText = false
      let didFinish = false
      let hasSeenClientChatEvent = false
      let streamStartedAt = 0
      let lifecycleFinishTimer: ReturnType<typeof setTimeout> | null = null
      let assistantFallbackTimer: ReturnType<typeof setTimeout> | null = null
      let pendingChatAliasTimer: ReturnType<typeof setTimeout> | null = null
      let pendingAssistantText: string | null = null
      let lifecycleEndAt = 0
      let lastChatEventAt = 0
      const approval = createApprovalRecovery(() => streamStartedAt)
      let pendingChatAliasRunId: string | null = null
      let pendingChatAliasEvent: OpenClawChatEvent | null = null
      const pendingToolCalls = new Set<string>()
      let textPartCounter = 1
      let currentTextPartId = `text-${textPartCounter}`
      let toolSplitPending = false
      let toolSplitAt = -1
      const buffered: GatewayEventFrame[] = []
      let unsubscribe: (() => void) | null = null
      const CHAT_ALIAS_GRACE_MS = 250

      const isStaleAgentEvent = (ts: unknown) => {
        if (typeof ts !== 'number') return false
        if (!Number.isFinite(ts)) return false
        if (streamStartedAt <= 0) return false
        // Drop events clearly older than current stream start, preventing cross-run/session pollution.
        return ts + 1000 < streamStartedAt
      }

      const isContinuationSnapshotEvent = (evt: OpenClawChatEvent) => {
        if (currentText.length === 0) return false
        if (evt.state !== 'delta' && evt.state !== 'final') return false
        const nextText = extractOpenClawTextFromMessage(evt.message) ?? ''
        if (!nextText) return false
        return nextText.length >= currentText.length && nextText.startsWith(currentText)
      }

      const clearPendingChatAlias = () => {
        if (pendingChatAliasTimer) {
          clearTimeout(pendingChatAliasTimer)
          pendingChatAliasTimer = null
        }
        pendingChatAliasRunId = null
        pendingChatAliasEvent = null
      }

      const queuePendingChatAlias = (evt: OpenClawChatEvent) => {
        if (!clientRunId) return
        if (evt.runId === clientRunId) return
        const isApprovalActive = approval.hasRecentApprovalActivity()
        const continuationSnapshot = isContinuationSnapshotEvent(evt)
        if (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) return
        if (didFinish) return
        if (boundChatRunId) return
        if (currentText.length > 0 && !isApprovalActive && !continuationSnapshot) return
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
          const continuationSnapshot = isContinuationSnapshotEvent(queuedEvent)
          if (
            (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) ||
            didFinish ||
            boundChatRunId ||
            (currentText.length > 0 && !isApprovalActive && !continuationSnapshot)
          ) {
            return
          }

          boundChatRunId = queuedRunId
          handleChatEvent(queuedEvent)
        }, CHAT_ALIAS_GRACE_MS)
      }

      const isCurrentChatRun = (rid: string) => {
        if (clientRunId != null && rid === clientRunId) return true
        return boundChatRunId != null && rid === boundChatRunId
      }

      const maybeBindChatRunId = (evt: OpenClawChatEvent) => {
        if (!clientRunId) return
        if (!evt.runId || evt.runId === clientRunId) return
        if (boundChatRunId) return
        const isApprovalActive = approval.hasRecentApprovalActivity()
        const continuationSnapshot = isContinuationSnapshotEvent(evt)
        if (hasSeenClientChatEvent && !isApprovalActive && !continuationSnapshot) return
        if (didFinish) return
        // NOTE:
        // OpenClaw exec approvals can pause a run for long periods. If we only allow
        // early-time binding, the resumed `chat.delta/final` (internal runId) is dropped,
        // causing "approved but no response until next message" regressions.
        //
        // Some runs emit pre-approval text on clientRunId, then resume on an internal runId.
        // During an approval recovery window, allow rebinding even after prior chat snapshots.
        if (currentText.length > 0 && !isApprovalActive && !continuationSnapshot) return
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

      const isCurrentAgentRun = (rid: string) => {
        if (clientRunId == null) return false
        if (rid === clientRunId) return true
        return boundAgentRunId != null && rid === boundAgentRunId
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

      const closeOnce = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (lifecycleFinishTimer) {
          clearTimeout(lifecycleFinishTimer)
          lifecycleFinishTimer = null
        }
        if (assistantFallbackTimer) {
          clearTimeout(assistantFallbackTimer)
          assistantFallbackTimer = null
        }
        if (pendingChatAliasTimer) {
          clearTimeout(pendingChatAliasTimer)
          pendingChatAliasTimer = null
        }
        controller.close()
      }

      const failOnce = (errorText: string) => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (lifecycleFinishTimer) {
          clearTimeout(lifecycleFinishTimer)
          lifecycleFinishTimer = null
        }
        if (assistantFallbackTimer) {
          clearTimeout(assistantFallbackTimer)
          assistantFallbackTimer = null
        }
        if (pendingChatAliasTimer) {
          clearTimeout(pendingChatAliasTimer)
          pendingChatAliasTimer = null
        }
        controller.enqueue({ type: 'error', errorText })
        controller.close()
      }

      // 工具到达时：关闭当前 text part，标记分割点
      const closeTextForToolSplit = () => {
        if (!didStartText || toolSplitPending) return
        controller.enqueue({ type: 'text-end', id: currentTextPartId })
        didStartText = false
        toolSplitPending = true
        toolSplitAt = currentText.length
      }

      // 工具后文本到达时：创建新 text part
      const startPostToolTextPart = () => {
        textPartCounter++
        currentTextPartId = `text-${textPartCounter}`
        didStartText = true
        toolSplitPending = false
        controller.enqueue({ type: 'text-start', id: currentTextPartId })
      }

      const ensureTextStarted = () => {
        if (didStartText) return
        didStartText = true
        controller.enqueue({ type: 'start-step' })
        controller.enqueue({ type: 'text-start', id: currentTextPartId })
      }

      const finishOnce = (opts?: { kind?: 'ok' | 'abort'; reason?: string }) => {
        if (didFinish) return
        didFinish = true
        if (lifecycleFinishTimer) {
          clearTimeout(lifecycleFinishTimer)
          lifecycleFinishTimer = null
        }
        if (assistantFallbackTimer) {
          clearTimeout(assistantFallbackTimer)
          assistantFallbackTimer = null
        }
        if (pendingChatAliasTimer) {
          clearTimeout(pendingChatAliasTimer)
          pendingChatAliasTimer = null
        }
        // Always close the active text part to avoid leaving it in "streaming".
        if (didStartText) {
          controller.enqueue({ type: 'text-end', id: currentTextPartId })
        }
        controller.enqueue({ type: 'finish-step' })
        if (opts?.kind === 'abort') {
          controller.enqueue({ type: 'abort', reason: opts.reason })
          controller.enqueue({ type: 'finish', finishReason: 'stop' })
        } else {
          controller.enqueue({ type: 'finish' })
        }
        closeOnce()
      }

      const onAbort = () => {
        if (!clientRunId) {
          finishOnce({ kind: 'abort', reason: 'aborted' })
          return
        }
        void adapter.abortChat?.({ sessionKey, runId: clientRunId }).catch(() => {})
        finishOnce({ kind: 'abort', reason: 'aborted' })
      }

      if (abortSignal) {
        if (abortSignal.aborted) {
          onAbort()
          return
        }
        abortSignal.addEventListener('abort', onAbort, { once: true })
      }

      const updateTextWithSnapshot = (nextText: string) => {
        if (!nextText) return
        // 工具后新文本到达 → 创建新 text part
        if (toolSplitPending && nextText.length > toolSplitAt) {
          startPostToolTextPart()
        }
        if (!currentText) {
          ensureTextStarted()
          currentText = nextText
          controller.enqueue({ type: 'text-delta', id: currentTextPartId, delta: nextText })
          return
        }
        // Ignore non-monotonic snapshots (best-effort).
        if (nextText.length < currentText.length) return
        ensureTextStarted()
        const delta = computeSuffixDelta(currentText, nextText)
        currentText = nextText
        if (delta) controller.enqueue({ type: 'text-delta', id: currentTextPartId, delta })
      }

      const handleChatEvent = (evt: OpenClawChatEvent) => {
        if (evt.sessionKey !== sessionKey) return
        if (clientRunId && evt.runId === clientRunId) {
          clearPendingChatAlias()
        }
        maybeBindChatRunId(evt)
        if (!isCurrentChatRun(evt.runId)) {
          queuePendingChatAlias(evt)
          return
        }
        clearPendingChatAlias()
        hasSeenClientChatEvent = true

        if (evt.state === 'delta' || evt.state === 'final') {
          if (assistantFallbackTimer) {
            clearTimeout(assistantFallbackTimer)
            assistantFallbackTimer = null
          }
          pendingAssistantText = null
          lastChatEventAt = Date.now()
          if (lifecycleFinishTimer) {
            clearTimeout(lifecycleFinishTimer)
            lifecycleFinishTimer = null
          }
          const nextText = extractOpenClawTextFromMessage(evt.message) ?? ''
          updateTextWithSnapshot(nextText)
          if (evt.state === 'final') {
            finishOnce()
          }
          return
        }

        if (evt.state === 'aborted') {
          finishOnce({ kind: 'abort', reason: 'aborted' })
          return
        }

        if (evt.state === 'error') {
          const msg = typeof evt.errorMessage === 'string' ? evt.errorMessage : 'chat error'
          failOnce(msg)
        }
      }

      const handleAssistantEvent = (evt: OpenClawAgentEventPayload) => {
        const assistantData =
          evt.data && typeof evt.data === 'object' ? (evt.data as Record<string, unknown>) : null
        maybeBindAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof assistantData?.phase === 'string' ? assistantData.phase : undefined,
        })
        if (!isCurrentAgentRun(evt.runId)) return
        if (evt.stream !== 'assistant') return
        // Preferred source remains `chat.delta/final`. But when some providers/runs
        // only emit assistant stream (or chat stream is delayed after approvals),
        // use assistant text as a fallback to avoid "approved but no visible reply".
        if (hasSeenClientChatEvent) return

        const text = typeof assistantData?.text === 'string' ? assistantData.text : ''
        if (!text) return

        pendingAssistantText = text
        if (assistantFallbackTimer) clearTimeout(assistantFallbackTimer)
        assistantFallbackTimer = setTimeout(() => {
          assistantFallbackTimer = null
          if (!pendingAssistantText) return
          if (hasSeenClientChatEvent) return

          const fallbackText = pendingAssistantText
          pendingAssistantText = null

          if (!currentText) {
            ensureTextStarted()
            currentText = fallbackText
            controller.enqueue({ type: 'text-delta', id: currentTextPartId, delta: fallbackText })
            return
          }

          // Handle both snapshot-like and chunk-like assistant payloads.
          if (fallbackText.startsWith(currentText)) {
            const delta = computeSuffixDelta(currentText, fallbackText)
            currentText = fallbackText
            if (delta) controller.enqueue({ type: 'text-delta', id: currentTextPartId, delta })
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
            controller.enqueue({ type: 'text-delta', id: currentTextPartId, delta: `${separator}${normalizedFallbackText}` })
            return
          }

          // Ambiguous divergence without approval/tool terminal context: avoid blind append,
          // otherwise old/stale runs can pollute the current assistant message.
          return
        }, 300)
      }

      const handleToolEvent = (evt: OpenClawAgentEventPayload, tool: OpenClawToolEventData) => {
        maybeBindAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof tool.phase === 'string' ? tool.phase : undefined,
        })
        if (!isCurrentAgentRun(evt.runId)) return

        const toolName = String(tool.name ?? '').trim()
        const toolRecord = tool as Record<string, unknown>
        const toolCallId = resolveToolCallId(toolRecord)
        const phase = typeof tool.phase === 'string' ? tool.phase : ''
        if (!toolName || !toolCallId) return

        const meta = typeof tool.meta === 'string' && tool.meta.trim() ? tool.meta.trim() : undefined

        if (phase === 'start') {
          closeTextForToolSplit()
          pendingToolCalls.add(toolCallId)
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName,
            input: tool.args,
            providerExecuted: true,
            // ClawUI doesn't ship a static tool registry; treat OpenClaw tool events as dynamic tools.
            dynamic: true,
            title: meta,
          })
          return
        }

        if (phase === 'update') {
          pendingToolCalls.add(toolCallId)
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: tool.partialResult,
            providerExecuted: true,
            dynamic: true,
            preliminary: true,
          })
          return
        }

        if (phase === 'result' || phase === 'end' || phase === 'error') {
          const isError = tool.isError === true || phase === 'error'
          const hasResult = typeof tool.result !== 'undefined'
          const hasPartialResult = typeof tool.partialResult !== 'undefined'

          // For exec/bash, `phase=end` can be an envelope close event without final payload.
          // Do not promote it to completed output in that case.
          if (phase === 'end' && !isError && !hasResult && !hasPartialResult) {
            pendingToolCalls.delete(toolCallId)
            return
          }

          pendingToolCalls.delete(toolCallId)
          approval.noteToolTerminalActivity()
          if (isError) {
            const errorText =
              typeof tool.result === 'string'
                ? tool.result
                : typeof tool.partialResult === 'string'
                  ? tool.partialResult
                  : 'tool error'
            controller.enqueue({
              type: 'tool-output-error',
              toolCallId,
              errorText,
              providerExecuted: true,
              dynamic: true,
            })
            return
          }

          const fallbackOutput =
            phase === 'result' && (toolName === 'exec' || toolName === 'bash')
              ? 'No output - tool completed successfully.'
              : ''
          const output = hasResult ? tool.result : hasPartialResult ? tool.partialResult : fallbackOutput

          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output,
            providerExecuted: true,
            dynamic: true,
          })
        }
      }

      const scheduleLifecycleFinish = () => {
        if (lifecycleFinishTimer) return
        lifecycleEndAt = lifecycleEndAt || Date.now()
        lifecycleFinishTimer = setTimeout(() => {
          lifecycleFinishTimer = null

          // Don't finish while tools are still running; exec can block chat.delta for a while.
          if (pendingToolCalls.size > 0) {
            scheduleLifecycleFinish()
            return
          }

          const now = Date.now()
          const idleForMs = lastChatEventAt > 0 ? now - lastChatEventAt : now - lifecycleEndAt
          const sinceEndMs = now - lifecycleEndAt

          // If we're still receiving chat.delta, keep waiting.
          if (lastChatEventAt > 0 && idleForMs < 800) {
            scheduleLifecycleFinish()
            return
          }

          // Give plenty of time for long-running tools; only use lifecycle=end as a last resort.
          if (sinceEndMs < 20_000) {
            scheduleLifecycleFinish()
            return
          }

          finishOnce()
        }, 1500)
      }

      const handleLifecycleEvent = (evt: OpenClawAgentEventPayload, lifecycle: OpenClawLifecycleEventData) => {
        maybeBindAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof lifecycle.phase === 'string' ? lifecycle.phase : undefined,
        })
        if (!isCurrentAgentRun(evt.runId)) return
        const phase = typeof lifecycle.phase === 'string' ? lifecycle.phase : null
        if (phase) {
          controller.enqueue({
            type: 'data-openclaw-lifecycle',
            data: {
              runId: evt.runId,
              sessionKey,
              seq: evt.seq,
              ts: evt.ts,
              phase,
              error: lifecycle.error,
              raw: lifecycle,
            },
          })
        }
        if (phase === 'end') {
          // Fallback only: OpenClaw 的 WS 事件顺序里 `agent.lifecycle=end` 往往早于 `chat.final`。
          // 如果这里立刻 finish，会导致尾部内容被截断（错过紧随其后的 chat.final）。
          //
          // 这里做一个“可被 chat.delta 取消”的兜底：只要后续还有 chat.delta/final，timer 会被清掉。
          scheduleLifecycleFinish()
          return
        }
        if (phase === 'error') {
          const errText = typeof lifecycle.error === 'string' ? lifecycle.error : 'agent error'
          failOnce(errText)
        }
      }

      const processEventFrame = (frame: GatewayEventFrame) => {
        if (frame.type !== 'event') return
        if (frame.event === 'exec.approval.requested') {
          const payload = frame.payload as
            | {
                request?: { sessionKey?: unknown }
                createdAtMs?: unknown
              }
            | undefined
          if (!payload || typeof payload !== 'object') return
          const approvalSessionKey =
            payload.request && typeof payload.request === 'object'
              ? (payload.request as { sessionKey?: unknown }).sessionKey
              : undefined
          if (approvalSessionKey !== sessionKey) return
          approval.noteApprovalActivity(payload.createdAtMs)
          return
        }
        if (frame.event === 'exec.approval.resolved') {
          // Some gateway versions only include id/decision; if we've seen a matching request
          // in this stream window, keep the alias window alive.
          if (approval.hasRecentApprovalActivity()) {
            approval.noteApprovalActivity()
          }
          return
        }
        if (frame.event === 'chat') {
          const payload = frame.payload as OpenClawChatEvent | undefined
          if (!payload || typeof payload !== 'object') return
          if (typeof payload.runId !== 'string') return
          if (typeof payload.sessionKey !== 'string') return
          if (typeof payload.state !== 'string') return
          if (!clientRunId) return
          handleChatEvent(payload)
          return
        }
        if (frame.event === 'agent') {
          const payload = frame.payload as OpenClawAgentEventPayload | undefined
          if (!payload || typeof payload !== 'object') return
          if (typeof payload.runId !== 'string') return
          if (!clientRunId) return
          if (typeof payload.stream !== 'string') return
          if (!payload.data || typeof payload.data !== 'object') return
          // Some agent events include sessionKey; if present, use it to avoid cross-session pollution.
          if (typeof payload.sessionKey === 'string' && payload.sessionKey !== sessionKey) return
          if (isStaleAgentEvent(payload.ts)) return

          if (payload.stream === 'tool') {
            handleToolEvent(payload, payload.data as unknown as OpenClawToolEventData)
            return
          }
          if (payload.stream === 'assistant') {
            handleAssistantEvent(payload)
            return
          }
          if (payload.stream === 'lifecycle') {
            handleLifecycleEvent(payload, payload.data as unknown as OpenClawLifecycleEventData)
          }
        }
      }

      const handleIncomingFrame = (frame: GatewayEventFrame) => {
        if (!clientRunId) {
          buffered.push(frame)
          return
        }
        processEventFrame(frame)
      }

      unsubscribe = adapter.onGatewayEvent(handleIncomingFrame)

      // Fire-and-forget async init.
      void (async () => {
        try {
          const connected = await adapter.isConnected?.()
          if (!connected) await adapter.connect?.()
          streamStartedAt = Date.now()
          clientRunId = await adapter.sendChat({ sessionKey, message: userText })

          controller.enqueue({ type: 'start', messageId: clientRunId })
          ensureTextStarted()

          for (const frame of buffered) processEventFrame(frame)
          buffered.length = 0
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          failOnce(msg)
        }
      })()
    },
  })
}
