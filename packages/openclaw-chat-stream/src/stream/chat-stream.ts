import type { UIMessage, UIMessageChunk } from 'ai'

import { extractOpenClawTextFromMessage } from './extract'
import { resolveToolCallId } from '@clawui/types/tool-call'
import { extractUserText } from './user'
import { createApprovalRecovery } from './approval-recovery'
import { createFinishPolicy } from './finish-policy'
import { createRunBinding } from './run-binding'
import { createMessageAssembler } from './message-assembler'
import { noopStreamLogger, type StreamLogger } from './logger'
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
  logger?: StreamLogger
}): ReadableStream<UIMessageChunk> {
  const { sessionKey, adapter, messages, abortSignal, trigger, logger: log = noopStreamLogger } = params

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
      let streamStartedAt = 0
      const buffered: GatewayEventFrame[] = []
      let unsubscribe: (() => void) | null = null
      let unsubDisconnect: (() => void) | null = null
      let unsubReconnect: (() => void) | null = null

      const approval = createApprovalRecovery(() => streamStartedAt)
      const enqueue = (chunk: UIMessageChunk) => controller.enqueue(chunk)

      const asm = createMessageAssembler(approval, { enqueue })

      const finish = createFinishPolicy({
        hasActiveTextPart: () => asm.hasActiveTextPart,
        activeTextPartId: () => asm.currentTextPartId,
        cancelExternalTimers: () => {
          asm.dispose()
          binding.dispose()
        },
        unsubscribe: () => { unsubscribe?.(); unsubDisconnect?.(); unsubReconnect?.() },
        enqueue,
        closeController: () => controller.close(),
      })

      const binding = createRunBinding(approval, {
        currentTextLength: () => asm.currentTextLength,
        isContinuationSnapshot: (evt) => {
          if (evt.state !== 'delta' && evt.state !== 'final') return false
          const nextText = extractOpenClawTextFromMessage(evt.message) ?? ''
          if (!nextText) return false
          return asm.isContinuationOf(nextText)
        },
        isFinished: () => finish.isFinished,
        onDeferredChatEvent: (evt) => handleChatEvent(evt),
      })

      const onAbort = () => {
        finish.onUserAbort(() => {
          void adapter.abortChat?.({ sessionKey, runId: finish.clientRunId! }).catch(() => {})
        })
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
        const verdict = binding.processChatRunId(evt)
        if (verdict !== 'accept') {
          log.debug('[bind.chat]', verdict, { runId: evt.runId, state: evt.state })
          return
        }
        binding.markClientChatSeen()

        if (evt.state === 'delta' || evt.state === 'final') {
          asm.lockToChatSource()
          finish.onChatDeltaOrFinal()
          const nextText = extractOpenClawTextFromMessage(evt.message) ?? ''
          asm.updateTextWithSnapshot(nextText)
          if (evt.state === 'final') {
            log.info('[stream.chatFinal]', { runId: evt.runId })
            finish.onChatFinal()
          }
          return
        }

        if (evt.state === 'aborted') {
          finish.onChatAborted('aborted')
          return
        }

        if (evt.state === 'error') {
          const msg = typeof evt.errorMessage === 'string' ? evt.errorMessage : 'chat error'
          log.warn('[stream.chatError]', msg)
          finish.onChatError(msg)
        }
      }

      const handleAssistantEvent = (evt: OpenClawAgentEventPayload) => {
        const assistantData =
          evt.data && typeof evt.data === 'object' ? (evt.data as Record<string, unknown>) : null
        const accepted = binding.processAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof assistantData?.phase === 'string' ? assistantData.phase : undefined,
        })
        if (!accepted) {
          log.debug('[bind.agent]', 'drop', { runId: evt.runId, stream: 'assistant' })
          return
        }
        if (evt.stream !== 'assistant') return
        if (binding.hasSeenClientChatEvent) return

        const text = typeof assistantData?.text === 'string' ? assistantData.text : ''
        if (!text) return

        asm.handleAssistantText(text, binding.hasSeenClientChatEvent)
      }

      const handleToolEvent = (evt: OpenClawAgentEventPayload, tool: OpenClawToolEventData) => {
        const accepted = binding.processAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof tool.phase === 'string' ? tool.phase : undefined,
        })
        if (!accepted) return

        const toolName = String(tool.name ?? '').trim()
        const toolRecord = tool as Record<string, unknown>
        const toolCallId = resolveToolCallId(toolRecord)
        const phase = typeof tool.phase === 'string' ? tool.phase : ''
        if (!toolName || !toolCallId) return

        const meta = typeof tool.meta === 'string' && tool.meta.trim() ? tool.meta.trim() : undefined

        if (phase === 'start') {
          asm.closeTextForToolSplit()
          finish.addPendingTool(toolCallId)
          enqueue({
            type: 'tool-input-available',
            toolCallId,
            toolName,
            input: tool.args,
            providerExecuted: true,
            dynamic: true,
            title: meta,
          })
          return
        }

        if (phase === 'update') {
          finish.addPendingTool(toolCallId)
          enqueue({
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

          if (phase === 'end' && !isError && !hasResult && !hasPartialResult) {
            finish.removePendingTool(toolCallId)
            return
          }

          finish.removePendingTool(toolCallId)
          approval.noteToolTerminalActivity()
          if (isError) {
            const errorText =
              typeof tool.result === 'string'
                ? tool.result
                : typeof tool.partialResult === 'string'
                  ? tool.partialResult
                  : 'tool error'
            enqueue({
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

          enqueue({
            type: 'tool-output-available',
            toolCallId,
            output,
            providerExecuted: true,
            dynamic: true,
          })
        }
      }

      const handleLifecycleEvent = (evt: OpenClawAgentEventPayload, lifecycle: OpenClawLifecycleEventData) => {
        const accepted = binding.processAgentRunId({
          rid: evt.runId,
          stream: evt.stream,
          seq: evt.seq,
          phase: typeof lifecycle.phase === 'string' ? lifecycle.phase : undefined,
        })
        if (!accepted) return
        const phase = typeof lifecycle.phase === 'string' ? lifecycle.phase : null
        if (phase) {
          enqueue({
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
          finish.onLifecycleEnd()
          return
        }
        if (phase === 'error') {
          const errText = typeof lifecycle.error === 'string' ? lifecycle.error : 'agent error'
          finish.onLifecycleError(errText)
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
          if (!binding.clientRunId) return
          handleChatEvent(payload)
          return
        }
        if (frame.event === 'agent') {
          const payload = frame.payload as OpenClawAgentEventPayload | undefined
          if (!payload || typeof payload !== 'object') return
          if (typeof payload.runId !== 'string') return
          if (!binding.clientRunId) return
          if (typeof payload.stream !== 'string') return
          if (!payload.data || typeof payload.data !== 'object') return
          if (typeof payload.sessionKey === 'string' && payload.sessionKey !== sessionKey) return
          if (binding.isStaleAgentEvent(payload.ts)) return

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
        if (!binding.clientRunId) {
          buffered.push(frame)
          return
        }
        processEventFrame(frame)
      }

      unsubscribe = adapter.onGatewayEvent(handleIncomingFrame)

      if (adapter.onDisconnected) {
        unsubDisconnect = adapter.onDisconnected(() => {
          if (finish.isClosed) return
          log.warn('[stream.disconnected]', { sessionKey })
          finish.onDisconnected(15_000)
        })
      }

      if (adapter.onReconnected) {
        unsubReconnect = adapter.onReconnected(() => {
          if (finish.isClosed) return
          log.info('[stream.reconnected]', { sessionKey })
          finish.onReconnected()
        })
      }

      void (async () => {
        try {
          const connected = await adapter.isConnected?.()
          if (!connected) await adapter.connect?.()
          streamStartedAt = Date.now()
          const runId = await adapter.sendChat({ sessionKey, message: userText })
          log.info('[stream.init]', { sessionKey, runId })
          binding.setClientRunId(runId)
          binding.setStreamStartedAt(streamStartedAt)
          finish.setClientRunId(runId)

          enqueue({ type: 'start', messageId: runId })
          asm.ensureTextStarted()

          for (const frame of buffered) processEventFrame(frame)
          buffered.length = 0
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log.warn('[stream.initError]', msg)
          finish.onInitError(msg)
        }
      })()
    },
  })
}
