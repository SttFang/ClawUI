import type { UIMessage, UIMessageChunk } from 'ai'

import { computeSuffixDelta } from './delta'
import { extractOpenClawTextFromMessage } from './extract'
import { extractUserText } from './user'
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
      let lifecycleEndAt = 0
      let lastChatEventAt = 0
      const pendingToolCalls = new Set<string>()
      const textPartId = 'text-1'
      const buffered: GatewayEventFrame[] = []
      let unsubscribe: (() => void) | null = null

      const isCurrentChatRun = (rid: string) => {
        if (clientRunId != null && rid === clientRunId) return true
        return boundChatRunId != null && rid === boundChatRunId
      }

      const maybeBindChatRunId = (evt: OpenClawChatEvent) => {
        if (!clientRunId) return
        if (!evt.runId || evt.runId === clientRunId) return
        if (boundChatRunId) return
        if (hasSeenClientChatEvent) return
        if (didFinish) return
        // NOTE:
        // OpenClaw exec approvals can pause a run for long periods. If we only allow
        // early-time binding, the resumed `chat.delta/final` (internal runId) is dropped,
        // causing "approved but no response until next message" regressions.
        //
        // As long as this stream has not observed its own client run yet, bind to the
        // first matching chat delta/final for the same session.
        if (currentText.length > 0) return
        const elapsed = streamStartedAt > 0 ? Date.now() - streamStartedAt : 0
        if (boundAgentRunId && evt.runId !== boundAgentRunId) return
        // Prevent accidental binding to stale old runs shortly after submit.
        // Once approval waits long enough, relax this guard.
        const likelyFreshSeq = typeof evt.seq === 'number' ? evt.seq <= 2 : true
        const allowDelayedBind = elapsed >= 30_000
        if (!boundAgentRunId && !likelyFreshSeq && !allowDelayedBind && evt.state !== 'final') return
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
        if (hasSeenClientChatEvent) return
        const elapsed = streamStartedAt > 0 ? Date.now() - streamStartedAt : 0
        const likelyFreshSeq = typeof seq === 'number' ? seq <= 12 : true
        const allowDelayedBind = elapsed >= 30_000
        if (!likelyFreshSeq && !allowDelayedBind) return

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
        controller.enqueue({ type: 'error', errorText })
        controller.close()
      }

      const ensureTextStarted = () => {
        if (didStartText) return
        didStartText = true
        controller.enqueue({ type: 'start-step' })
        controller.enqueue({ type: 'text-start', id: textPartId })
      }

      const finishOnce = (opts?: { kind?: 'ok' | 'abort'; reason?: string }) => {
        if (didFinish) return
        didFinish = true
        if (lifecycleFinishTimer) {
          clearTimeout(lifecycleFinishTimer)
          lifecycleFinishTimer = null
        }
        // Always close the active text part to avoid leaving it in "streaming".
        if (didStartText) {
          controller.enqueue({ type: 'text-end', id: textPartId })
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
        if (!currentText) {
          ensureTextStarted()
          currentText = nextText
          controller.enqueue({ type: 'text-delta', id: textPartId, delta: nextText })
          return
        }
        // Ignore non-monotonic snapshots (best-effort).
        if (nextText.length < currentText.length) return
        ensureTextStarted()
        const delta = computeSuffixDelta(currentText, nextText)
        currentText = nextText
        if (delta) controller.enqueue({ type: 'text-delta', id: textPartId, delta })
      }

      const handleChatEvent = (evt: OpenClawChatEvent) => {
        if (evt.sessionKey !== sessionKey) return
        maybeBindChatRunId(evt)
        if (!isCurrentChatRun(evt.runId)) return
        hasSeenClientChatEvent = true

        if (evt.state === 'delta' || evt.state === 'final') {
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
        // OpenClaw 的 `chat.delta` 是累计快照，最终也由 assistant.text 映射而来。
        // 过去同时消费 `agent.assistant` + `chat.delta` 会出现“重复/口吃式”拼接：
        // 两条流的粒度/节流策略不同，偶发导致 append-only 的 delta 合成失真。
        //
        // v1 策略：以 `chat.delta/final` 作为唯一文本来源；assistant 流只用于补充 tool/lifecycle 等结构化信息。
        void evt
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
        const toolCallId = String(tool.toolCallId ?? '').trim()
        if (!toolName || !toolCallId) return

        const meta = typeof tool.meta === 'string' && tool.meta.trim() ? tool.meta.trim() : undefined

        if (tool.phase === 'start') {
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

        if (tool.phase === 'update') {
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

        if (tool.phase === 'result') {
          pendingToolCalls.delete(toolCallId)
          const isError = tool.isError === true
          if (isError) {
            controller.enqueue({
              type: 'tool-output-error',
              toolCallId,
              errorText: 'tool error',
              providerExecuted: true,
              dynamic: true,
            })
            return
          }
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: tool.result,
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
