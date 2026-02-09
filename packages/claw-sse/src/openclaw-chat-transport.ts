import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'

export type GatewayEventFrame = {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

type OpenClawChatEvent = {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
  usage?: unknown
  stopReason?: string
}

type OpenClawAgentEventPayload = {
  runId: string
  seq: number
  stream: string
  ts: number
  data: Record<string, unknown>
  sessionKey?: string
}

type OpenClawToolEventData = {
  phase: 'start' | 'update' | 'result'
  name: string
  toolCallId: string
  args?: unknown
  partialResult?: unknown
  result?: unknown
  meta?: unknown
  isError?: unknown
}

type OpenClawLifecycleEventData = {
  phase?: unknown
  error?: unknown
}

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

function extractOpenClawTextFromMessage(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content) || content.length === 0) return null
  const first = content[0] as { type?: unknown; text?: unknown } | undefined
  if (!first || typeof first !== 'object') return null
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text : null
}

function computeSuffixDelta(prev: string, next: string): string {
  if (!next) return ''
  if (!prev) return next
  if (next.length <= prev.length) return ''
  if (next.startsWith(prev)) return next.slice(prev.length)
  // Best-effort: fall back to longest common prefix.
  const max = Math.min(prev.length, next.length)
  let i = 0
  while (i < max && prev.charCodeAt(i) === next.charCodeAt(i)) i++
  return next.slice(i)
}

function extractUserText(message: UIMessage | undefined): string | null {
  if (!message) return null
  if (message.role !== 'user') return null
  for (const part of message.parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      return part.text
    }
  }
  return null
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
          const textPartId = 'text-1'
          const buffered: GatewayEventFrame[] = []
          let unsubscribe: (() => void) | null = null

          const closeOnce = () => {
            if (closed) return
            closed = true
            unsubscribe?.()
            controller.close()
          }

          const failOnce = (errorText: string) => {
            if (closed) return
            closed = true
            unsubscribe?.()
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
              // Some runs might not emit `event chat final` (best-effort safety).
              finishOnce()
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
