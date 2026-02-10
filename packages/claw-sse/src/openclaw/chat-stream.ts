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
  const userText = extractUserText(last) ?? extractUserText([...messages].reverse().find((m) => m.role === 'user'))
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
      // `chat.send` 的 idempotencyKey（ClawUI 侧用作 messageId）不一定等于 agent 内部 runId。
      // OpenClaw 可能会用内部 runId 来广播 `event chat` / `event agent`，这会导致严格按 runId 过滤时“收不到流”。
      //
      // 这里做一个“自动绑定”：
      // - clientRunId：本次 chat.send 的稳定 idempotencyKey（用于 abort）
      // - observedRunId：从 event chat/agent 首次观测到的内部 runId（用于匹配后续事件）
      let clientRunId: string | null = null
      let observedRunId: string | null = null
      let closed = false
      let currentText = ''
      let didStartText = false
      let didFinish = false
      let lifecycleFinishTimer: ReturnType<typeof setTimeout> | null = null
      let lastChatEventAt = 0
      const textPartId = 'text-1'
      const buffered: GatewayEventFrame[] = []
      let unsubscribe: (() => void) | null = null

      const isCurrentRun = (rid: string) => {
        if (clientRunId && rid === clientRunId) return true
        if (observedRunId && rid === observedRunId) return true
        return false
      }

      const maybeAdoptObservedRunId = (rid: string) => {
        if (!rid) return
        // Prefer keeping observedRunId stable once chosen.
        if (observedRunId) return
        // If the server uses a different internal id than our idempotency key, bind to it.
        if (clientRunId && rid !== clientRunId) {
          observedRunId = rid
          return
        }
        // If clientRunId is not yet known (should be rare), bind anyway.
        if (!clientRunId) {
          observedRunId = rid
        }
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
        maybeAdoptObservedRunId(evt.runId)
        if (!isCurrentRun(evt.runId)) return

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
        maybeAdoptObservedRunId(evt.runId)
        if (!isCurrentRun(evt.runId)) return
        if (evt.stream !== 'assistant') return
        // OpenClaw 的 `chat.delta` 是累计快照，最终也由 assistant.text 映射而来。
        // 过去同时消费 `agent.assistant` + `chat.delta` 会出现“重复/口吃式”拼接：
        // 两条流的粒度/节流策略不同，偶发导致 append-only 的 delta 合成失真。
        //
        // v1 策略：以 `chat.delta/final` 作为唯一文本来源；assistant 流只用于补充 tool/lifecycle 等结构化信息。
        void evt
      }

      const handleToolEvent = (evt: OpenClawAgentEventPayload, tool: OpenClawToolEventData) => {
        maybeAdoptObservedRunId(evt.runId)
        if (!isCurrentRun(evt.runId)) return

        const toolName = String(tool.name ?? '').trim()
        const toolCallId = String(tool.toolCallId ?? '').trim()
        if (!toolName || !toolCallId) return

        const meta = typeof tool.meta === 'string' && tool.meta.trim() ? tool.meta.trim() : undefined

        if (tool.phase === 'start') {
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

      const handleLifecycleEvent = (evt: OpenClawAgentEventPayload, lifecycle: OpenClawLifecycleEventData) => {
        maybeAdoptObservedRunId(evt.runId)
        if (!isCurrentRun(evt.runId)) return
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
          if (!lifecycleFinishTimer) {
            lifecycleFinishTimer = setTimeout(() => {
              const idleForMs = Date.now() - lastChatEventAt
              // 如果最近仍在收到 chat.delta，说明还没收敛，不要提前结束。
              if (lastChatEventAt > 0 && idleForMs < 800) return
              finishOnce()
            }, 1500)
          }
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
