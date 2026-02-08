import { useRef, useEffect } from 'react'
import { Send, Plus, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore, selectMessages, selectSessions, selectIsLoading, selectInput, selectCurrentSession } from '@/store/chat'
import { useGatewayStore, selectIsGatewayRunning } from '@/store/gateway'
import { cn } from '@/lib/utils'
import { Button, ScrollArea } from '@clawui/ui'

export default function ChatPage() {
  const messages = useChatStore(selectMessages)
  const sessions = useChatStore(selectSessions)
  const currentSession = useChatStore(selectCurrentSession)
  const isLoading = useChatStore(selectIsLoading)
  const input = useChatStore(selectInput)
  const { setInput, sendMessage, createSession, selectSession, deleteSession } = useChatStore()
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button
            onClick={() => createSession()}
            className="w-full"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
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
                <span className="flex-1 truncate text-sm">{session.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation</p>
                <p className="text-sm mt-2">
                  {isGatewayRunning
                    ? 'Gateway is running. Send a message to begin.'
                    : 'Gateway is not running. Please check settings.'}
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' && 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-2',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                      message.isStreaming && 'animate-pulse'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content || '...'}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 resize-none rounded-lg border bg-background px-4 py-2 min-h-[44px] max-h-32 focus:outline-none focus:ring-2 focus:ring-ring"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
