import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

import { computeSuffixDelta } from './openclaw/delta'
import { extractOpenClawTextFromMessage } from './openclaw/extract'
import { extractUserText } from './openclaw/user'
import type {
  GatewayEventFrame,
  OpenClawAgentEventPayload,
  OpenClawChatEvent,
  OpenClawLifecycleEventData,
  OpenClawToolEventData,
} from './openclaw/types'

export type { GatewayEventFrame } from './openclaw/types'

export type OpenClawChatTransportAdapter = {
  /**
   * Subscribe to raw Gateway events (ACP `type="event"` frames).
   * Must return an unsubscribe function.
   */
  onGatewayEvent: (handler: (event: GatewayEventFrame) => void) => () => void

  /**
   * Best-effort connectivity primitives.
   */
  isConnected?: () => boolean | Promise<boolean>
  connect?: () => void | Promise<void>

  /**
   * Send a WebChat message via OpenClaw Gateway (`chat.send`).
   * Must return the `runId` (typically equals `idempotencyKey`).
   */
  sendChat: (params: { sessionKey: string; message: string }) => Promise<string>

  /**
   * Abort a running WebChat run (`chat.abort`). Optional in v1, but recommended.
   */
  abortChat?: (params: { sessionKey: string; runId?: string }) => Promise<void>
}

export function createOpenClawChatTransport(params: {
  sessionKey: string
  adapter: OpenClawChatTransportAdapter
}): ChatTransport<UIMessage> {
  const { sessionKey, adapter } = params

  return {
    async sendMessages({ messages, abortSignal, trigger }): Promise<ReadableStream<UIMessageChunk>> {
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
          let prevChatSnapshot = ''
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

          const handleChatEvent = (evt: OpenClawChatEvent) => {
            if (evt.sessionKey !== sessionKey) return
            if (evt.runId !== runId) return

            if (evt.state === 'delta' || evt.state === 'final') {
              const nextText = extractOpenClawTextFromMessage(evt.message) ?? ''
              if (nextText) {
                ensureTextStarted()
                const delta = computeSuffixDelta(prevChatSnapshot, nextText)
                prevChatSnapshot = nextText
                if (delta) controller.enqueue({ type: 'text-delta', id: textPartId, delta })
              }
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
                dynamic: true,
                providerExecuted: true,
                title: meta,
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
            if (evt.runId !== runId) return
            const phase = typeof lifecycle.phase === 'string' ? lifecycle.phase : null
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
    },

    async reconnectToStream() {
      return null
    },
  }
}
