import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { ArrowDown, MessageSquare, Plus, Send, Sparkles, Trash2 } from 'lucide-react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { createMathPlugin } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'
import {
  createOpenClawChatTransport,
  openclawTranscriptToUIMessages,
  type OpenClawChatTransportAdapter,
} from '@clawui/claw-sse'
import { Button, ScrollArea } from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import type { ClawUISessionMetadata } from '@clawui/types/clawui'
import { ConfigBanner } from '@/components/ConfigBanner'
import { LifecycleEventCard, ToolEventCard, type OpenClawLifecycleData } from '@/components/A2UI'
import { ipc } from '@/lib/ipc'
import { cn } from '@/lib/utils'
import { useChatStore, selectCurrentSession, selectSessions } from '@/store/chat'
import { useGatewayStore, selectIsGatewayRunning } from '@/store/gateway'

const STREAMDOWN_PLUGINS = {
  code,
  mermaid,
  // OpenClaw 输出里经常用 `$...$` 做行内公式；这里显式开启。
  math: createMathPlugin({ singleDollarTextMath: true }),
  cjk,
}

function createRendererOpenClawAdapter(): OpenClawChatTransportAdapter {
  let connectPromise: Promise<void> | null = null

  return {
    onGatewayEvent: (handler) => ipc.gateway.onEvent(handler),
    isConnected: () => ipc.chat.isConnected(),
    connect: async () => {
      if (connectPromise) return connectPromise
      connectPromise = (async () => {
        const ok = await ipc.chat.connect()
        if (!ok) throw new Error('Failed to connect gateway WebSocket')
      })().finally(() => {
        connectPromise = null
      })
      return connectPromise
    },
    sendChat: async ({ sessionKey, message }) => {
      return ipc.chat.send({ sessionId: sessionKey, message })
    },
    abortChat: async ({ sessionKey, runId }) => {
      await ipc.chat.request('chat.abort', { sessionKey, runId })
    },
  }
}

function ScrollToBottomButton() {
  const { t } = useTranslation('chat')
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  if (isAtBottom) return null

  return (
    <button
      type="button"
      className={cn(
        'absolute bottom-3 left-1/2 -translate-x-1/2',
        'flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm',
        'text-muted-foreground hover:text-foreground hover:bg-background'
      )}
      onClick={() => void scrollToBottom()}
      aria-label={t('scrollToLatestAria')}
    >
      <ArrowDown className="h-4 w-4" />
      <span>{t('scrollToLatest')}</span>
    </button>
  )
}

function MessageText(props: { text: string; isAnimating: boolean }) {
  const { text, isAnimating } = props
  const normalized = normalizeMathDelimiters(text)
  return (
    <Streamdown
      plugins={STREAMDOWN_PLUGINS}
      mode={isAnimating ? 'streaming' : 'static'}
      isAnimating={isAnimating}
      parseIncompleteMarkdown
      className="break-words"
    >
      {normalized}
    </Streamdown>
  )
}

function normalizeMathDelimiters(markdown: string): string {
  // 将 `\\( ... \\)` / `\\[ ... \\]` 转成 remark-math 可解析的 `$` / `$$`。
  // 为了避免破坏 fenced code block，这里只在非 ``` fence 区域做替换。
  const lines = markdown.split('\n')
  let inFence = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''

    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }

    if (inFence) continue

    lines[i] = line
      .replaceAll('\\[', '$$')
      .replaceAll('\\]', '$$')
      .replaceAll('\\(', '$')
      .replaceAll('\\)', '$')
  }

  return lines.join('\n')
}

function MessageParts(props: { message: UIMessage; streaming: boolean }) {
  const { message, streaming } = props

  return (
    <div className="space-y-3">
      {message.parts.map((part, index) => {
        if (part.type === 'step-start') return null
        if (part.type === 'text') {
          if (!part.text.trim()) return null
          return <MessageText key={index} text={part.text} isAnimating={streaming && part.state === 'streaming'} />
        }
        if (part.type === 'dynamic-tool') {
          return <ToolEventCard key={index} part={part} />
        }
        if (part.type === 'data-openclaw-lifecycle') {
          return <LifecycleEventCard key={index} data={(part as unknown as { data: OpenClawLifecycleData }).data} />
        }
        // v1: ignore other parts (files, reasoning, sources, data parts, static tools).
        return null
      })}
    </div>
  )
}

function OpenClawChatPanel(props: { sessionKey: string; wsConnected: boolean; isGatewayRunning: boolean }) {
  const { sessionKey, wsConnected, isGatewayRunning } = props
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')

  const adapter = useMemo(() => createRendererOpenClawAdapter(), [])
  const transport = useMemo(() => createOpenClawChatTransport({ sessionKey, adapter }), [sessionKey, adapter])

  const chat = useChat({ id: sessionKey, transport })
  const [input, setInput] = useState('')

  const isBusy = chat.status === 'submitted' || chat.status === 'streaming'

  const refreshHistory = useCallback(async () => {
    try {
      const connected = await ipc.chat.isConnected()
      if (!connected) {
        const ok = await ipc.chat.connect()
        if (!ok) return
      }
      const res = (await ipc.chat.request('chat.history', { sessionKey, limit: 200 })) as {
        messages?: unknown
      }
      const uiMessages = openclawTranscriptToUIMessages(res?.messages)
      chat.setMessages(uiMessages)
    } catch {
      // best-effort only
    }
  }, [sessionKey, chat])

  // OpenClaw Control UI: chat.final 到达后用 history 作为权威状态刷新（避免 delta/agent 流丢字段）。
  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    return ipc.gateway.onEvent((frame) => {
      if (frame.type !== 'event') return
      if (frame.event !== 'chat') return
      const payload = frame.payload as { sessionKey?: unknown; state?: unknown } | undefined
      if (!payload || typeof payload !== 'object') return
      if (payload.sessionKey !== sessionKey) return
      if (payload.state === 'final') {
        void refreshHistory()
      }
    })
  }, [sessionKey, refreshHistory])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isBusy) return
    setInput('')
    await chat.sendMessage({ text })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Messages */}
      <StickToBottom
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4',
          // 允许触控/触控板在该区域垂直滚动
          'touch-pan-y'
        )}
        resize="smooth"
        initial="smooth"
      >
	        <StickToBottom.Content className="mx-auto flex w-full max-w-3xl flex-col gap-4">
	          {chat.messages.length === 0 ? (
	            <div className="text-center text-muted-foreground py-12">
	              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
	              <p>{t('emptyTitle')}</p>
	              <p className="text-sm mt-2">
	                {isGatewayRunning
	                  ? wsConnected
	                    ? t('emptyHintConnected')
	                    : t('emptyHintWsDisconnected')
	                  : t('emptyHintGatewayStopped')}
	              </p>
	            </div>
	          ) : (
            chat.messages.map((message) => {
              const isUser = message.role === 'user'
              const streaming = chat.status === 'streaming' && message.role === 'assistant'

              return (
                <div
                  key={message.id}
                  className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'min-w-0 max-w-[85%] sm:max-w-[75%]',
                      isUser ? 'ml-auto text-right' : 'mr-auto text-left'
                    )}
                  >
                    {isUser ? (
                      <div className="inline-block max-w-full rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                        <MessageParts message={message} streaming={false} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="inline-block max-w-full rounded-xl bg-muted px-4 py-3">
                          <MessageParts message={message} streaming={streaming} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

	          {chat.error ? (
	            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
	              <div className="font-medium">{t('errorTitle')}</div>
	              <div className="mt-1">{chat.error.message}</div>
	              <div className="mt-3">
	                <Button variant="outline" size="sm" onClick={() => chat.clearError()}>
	                  {tCommon('actions.close')}
	                </Button>
	              </div>
	            </div>
	          ) : null}
        </StickToBottom.Content>

        <ScrollToBottomButton />
      </StickToBottom>

      {/* Input area */}
	      <div className="border-t p-4">
	        <div className="mx-auto flex w-full max-w-3xl gap-2">
	          <textarea
	            value={input}
	            onChange={(e) => setInput(e.target.value)}
	            onKeyDown={handleKeyDown}
	            placeholder={t('inputPlaceholder')}
	            className={cn(
	              'flex-1 resize-none rounded-lg border bg-background px-4 py-2',
	              'min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-ring'
	            )}
	            rows={1}
            disabled={isBusy}
          />
          <Button onClick={() => void handleSend()} disabled={!input.trim() || isBusy} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { t } = useTranslation('chat')
  const sessions = useChatStore(selectSessions)
  const currentSession = useChatStore(selectCurrentSession)
  const wsConnected = useChatStore((s) => s.wsConnected)
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning)

  const createSession = useChatStore((s) => s.createSession)
  const refreshSessions = useChatStore((s) => s.refreshSessions)
  const selectSession = useChatStore((s) => s.selectSession)
  const deleteSession = useChatStore((s) => s.deleteSession)

  const [configValid, setConfigValid] = useState<boolean | null>(null)
  const [showBanner, setShowBanner] = useState(true)
  const [didLoadSessions, setDidLoadSessions] = useState(false)
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, ClawUISessionMetadata>>({})
  const [metaBusyByKey, setMetaBusyByKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void refreshSessions().finally(() => setDidLoadSessions(true))
  }, [refreshSessions])

  useEffect(() => {
    if (!didLoadSessions) return
    if (sessions.length > 0) return
    createSession()
  }, [didLoadSessions, sessions.length, createSession])

  // Check config validity on mount
  useEffect(() => {
    async function checkConfig() {
      try {
        const status = await ipc.onboarding.detect()
        setConfigValid(status?.configValid ?? false)
      } catch {
        setConfigValid(false)
      }
    }
    void checkConfig()
  }, [])

  useEffect(() => {
    ipc.state
      .get()
      .then((state) => setSessionMetadata(state.sessions?.metadata ?? {}))
      .catch(() => {})
  }, [])

  const generateMetadata = async (key: string) => {
    setMetaBusyByKey((m) => ({ ...m, [key]: true }))
    try {
      const meta = await ipc.metadata.generate(key)
      setSessionMetadata((prev) => ({ ...prev, [key]: meta }))
    } finally {
      setMetaBusyByKey((m) => ({ ...m, [key]: false }))
    }
  }

  const handleDismissBanner = () => {
    setShowBanner(false)
  }

  return (
    <div className="flex h-full min-h-0">
	      {/* Sessions sidebar */}
	      <div className="flex min-h-0 w-64 flex-col border-r bg-card">
	        <div className="p-4 border-b">
	          <Button onClick={() => createSession()} className="w-full" variant="outline">
	            <Plus className="w-4 h-4 mr-2" />
	            {t('newSession')}
	          </Button>
	        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer',
                  'hover:bg-accent transition-colors',
                  currentSession?.id === session.id && 'bg-accent'
                )}
                onClick={() => selectSession(session.id)}
              >
                <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {sessionMetadata[session.id]?.title ?? session.name}
                  </div>
                  {sessionMetadata[session.id]?.summary ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {sessionMetadata[session.id]?.summary}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void generateMetadata(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-foreground transition-opacity"
                  aria-label={t('generateSessionMetaAria')}
                  disabled={!!metaBusyByKey[session.id]}
                >
                  <Sparkles className={cn('w-3 h-3', metaBusyByKey[session.id] && 'animate-pulse')} />
                </button>
	                <button
	                  type="button"
	                  onClick={(e) => {
	                    e.stopPropagation()
	                    deleteSession(session.id)
	                  }}
	                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
	                  aria-label={t('deleteSessionAria')}
	                >
	                  <Trash2 className="w-3 h-3" />
	                </button>
	              </div>
	            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Config Banner */}
        {configValid === false && showBanner ? (
          <div className="p-4 pb-0">
            <ConfigBanner onDismiss={handleDismissBanner} />
          </div>
        ) : null}

        {currentSession?.id ? (
          <OpenClawChatPanel
            key={currentSession.id}
            sessionKey={currentSession.id}
            wsConnected={wsConnected}
            isGatewayRunning={isGatewayRunning}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Create a session to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
