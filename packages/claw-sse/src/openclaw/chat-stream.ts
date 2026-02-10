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
      let runId: string | null = null
      let closed = false
      let currentText = ''
      let didStartText = false
      let didFinish = false
      let lifecycleFinishTimer: ReturnType<typeof setTimeout> | null = null
      const textPartId = 'text-1'
      const buffered: GatewayEventFrame[] = []
      let unsubscribe: (() => void) | null = null

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
        if (!runId) {
          finishOnce({ kind: 'abort', reason: 'aborted' })
          return
        }
        void adapter.abortChat?.({ sessionKey, runId }).catch(() => {})
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

      const updateTextWithDelta = (delta: string, fullText?: string) => {
        if (!delta && !fullText) return
        ensureTextStarted()
        if (fullText && fullText.length >= currentText.length) {
          const d = computeSuffixDelta(currentText, fullText)
          currentText = fullText
          if (d) controller.enqueue({ type: 'text-delta', id: textPartId, delta: d })
          return
        }
        if (delta) {
          currentText += delta
          controller.enqueue({ type: 'text-delta', id: textPartId, delta })
        }
      }

      const handleChatEvent = (evt: OpenClawChatEvent) => {
        if (evt.sessionKey !== sessionKey) return
        if (evt.runId !== runId) return

        if (evt.state === 'delta' || evt.state === 'final') {
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
        if (evt.runId !== runId) return
        if (evt.stream !== 'assistant') return
        const data = evt.data ?? {}
        const delta = typeof (data as { delta?: unknown }).delta === 'string' ? String((data as { delta?: unknown }).delta) : ''
        const text = typeof (data as { text?: unknown }).text === 'string' ? String((data as { text?: unknown }).text) : undefined
        if (delta || text) {
          updateTextWithDelta(delta, text)
        }
      }

      const handleToolEvent = (evt: OpenClawAgentEventPayload, tool: OpenClawToolEventData) => {
        if (evt.runId !== runId) return

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
            })
            return
          }
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId,
            output: tool.result,
            providerExecuted: true,
          })
        }
      }

      const handleLifecycleEvent = (evt: OpenClawAgentEventPayload, lifecycle: OpenClawLifecycleEventData) => {
        if (evt.runId !== runId) return
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
          // Fallback only: OpenClaw 的 WS 事件里 `agent.lifecycle=end` 往往早于 `chat.final`，
          // 如果这里立刻 finish，会导致尾部内容被截断（错过紧随其后的 chat.final）。
          // 这里做一个短延迟的兜底：如果 chat.final 没来，再结束流。
          if (!lifecycleFinishTimer) {
            lifecycleFinishTimer = setTimeout(() => finishOnce(), 250)
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
          if (!runId) return
          handleChatEvent(payload)
          return
        }
        if (frame.event === 'agent') {
          const payload = frame.payload as OpenClawAgentEventPayload | undefined
          if (!payload || typeof payload !== 'object') return
          if (typeof payload.runId !== 'string') return
          if (!runId) return
          if (payload.runId !== runId) return
          if (typeof payload.stream !== 'string') return
          if (!payload.data || typeof payload.data !== 'object') return

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
        if (!runId) {
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
          runId = await adapter.sendChat({ sessionKey, message: userText })

          controller.enqueue({ type: 'start', messageId: runId })
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
