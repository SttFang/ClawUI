import { create } from 'zustand'
import { ipc, ChatStreamEvent } from '@/lib/ipc'
import { chatLog } from '@/lib/logger'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface Session {
  id: string
  name: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

interface ChatState {
  sessions: Session[]
  currentSessionId: string | null
  isLoading: boolean
  input: string
  wsConnected: boolean
}

interface ChatActions {
  createSession: (name?: string) => string
  selectSession: (id: string | null) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  updateStreamingMessage: (id: string, content: string) => void
  appendMessageContent: (id: string, content: string) => void
  setMessageStreaming: (id: string, isStreaming: boolean) => void
  setInput: (input: string) => void
  setLoading: (loading: boolean) => void
  setWsConnected: (connected: boolean) => void
  sendMessage: (content: string) => Promise<void>
  clearCurrentSession: () => void
  connectWebSocket: (url?: string) => Promise<void>
  disconnectWebSocket: () => Promise<void>
}

type ChatStore = ChatState & ChatActions

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  input: '',
  wsConnected: false,
}

let messageIdCounter = 0
const generateMessageId = () => `msg_${Date.now()}_${messageIdCounter++}`

let sessionIdCounter = 0
const generateSessionId = () => `session_${Date.now()}_${sessionIdCounter++}`

export const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,

  createSession: (name) => {
    const id = generateSessionId()
    const now = Date.now()
    const session: Session = {
      id,
      name: name || `Session ${get().sessions.length + 1}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      sessions: [...state.sessions, session],
      currentSessionId: id,
    }))
    return id
  },

  selectSession: (id) => set({ currentSessionId: id }),

  deleteSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
    })),

  renameSession: (id, name) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, name, updatedAt: Date.now() } : s
      ),
    })),

  addMessage: (message) => {
    const { currentSessionId, createSession } = get()
    let sessionId = currentSessionId

    // Create a new session if none exists
    if (!sessionId) {
      sessionId = createSession()
    }

    const newMessage: Message = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [...s.messages, newMessage],
              updatedAt: Date.now(),
            }
          : s
      ),
    }))
  },

  updateMessage: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, content, isStreaming: false } : m
        ),
      })),
    })),

  updateStreamingMessage: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => {
          if (m.id !== id) return m
          // OpenClaw chat delta payloads are cumulative; avoid regressing to shorter snapshots.
          if (!m.content || content.length >= m.content.length) {
            return { ...m, content }
          }
          return m
        }),
      })),
    })),

  appendMessageContent: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, content: m.content + content } : m
        ),
      })),
    })),

  setMessageStreaming: (id, isStreaming) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === id ? { ...m, isStreaming } : m
        ),
      })),
    })),

  setInput: (input) => set({ input }),
  setLoading: (isLoading) => set({ isLoading }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  connectWebSocket: async (url) => {
    try {
      await ipc.chat.connect(url)
    } catch (error) {
      chatLog.error('Failed to connect WebSocket:', error)
    }
  },

  disconnectWebSocket: async () => {
    try {
      await ipc.chat.disconnect()
    } catch (error) {
      chatLog.error('Failed to disconnect WebSocket:', error)
    }
  },

  sendMessage: async (content) => {
    const { addMessage, setLoading, updateMessage, currentSessionId, createSession, wsConnected } = get()

    // Create session if needed
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    // Add user message
    addMessage({ role: 'user', content })
    set({ input: '' })
    setLoading(true)

    // Add placeholder assistant message
    const placeholderMessageId = generateMessageId()
    set((state) => {
      const sid = state.currentSessionId
      if (!sid) return state

      return {
        sessions: state.sessions.map((s) =>
          s.id === sid
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: placeholderMessageId,
                    role: 'assistant' as const,
                    content: '',
                    timestamp: Date.now(),
                    isStreaming: true,
                  },
                ],
                updatedAt: Date.now(),
              }
            : s
        ),
      }
    })

    try {
      if (wsConnected) {
        // Send via WebSocket - the actual messageId will be returned
        const messageId = await ipc.chat.send({
          sessionId: sessionId!,
          message: content,
        })
        // Update the placeholder message with the actual messageId
        set((state) => ({
          sessions: state.sessions.map((s) => ({
            ...s,
            messages: s.messages.map((m) =>
              m.id === placeholderMessageId ? { ...m, id: messageId } : m
            ),
          })),
        }))
      } else {
        // Fallback to simulated response when WebSocket is not connected
        await new Promise((resolve) => setTimeout(resolve, 1000))
        updateMessage(placeholderMessageId, 'WebSocket not connected. Please connect to the gateway first.')
        setLoading(false)
      }
    } catch (error) {
      chatLog.error('Failed to send message:', error)
      updateMessage(placeholderMessageId, 'Error: Failed to send message to gateway.')
      setLoading(false)
    }
  },

  clearCurrentSession: () =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === state.currentSessionId
          ? { ...s, messages: [], updatedAt: Date.now() }
          : s
      ),
    })),
}))

// Selectors - use stable references to prevent infinite re-renders in React 19
export const selectCurrentSession = (state: ChatStore): Session | undefined =>
  state.sessions.find((s) => s.id === state.currentSessionId)

const EMPTY_MESSAGES: Message[] = []
export const selectMessages = (state: ChatStore): Message[] => {
  const session = state.sessions.find((s) => s.id === state.currentSessionId)
  return session?.messages ?? EMPTY_MESSAGES
}

export const selectSessions = (state: ChatStore) => state.sessions
export const selectIsLoading = (state: ChatStore) => state.isLoading
export const selectInput = (state: ChatStore) => state.input
export const selectWsConnected = (state: ChatStore) => state.wsConnected

// Initialize WebSocket stream listener
let chatStreamListenerInitialized = false
export function initChatStreamListener() {
  if (chatStreamListenerInitialized || typeof window === 'undefined') return
  chatStreamListenerInitialized = true

  // Handle stream events
  ipc.chat.onStream((event: ChatStreamEvent) => {
    const { updateStreamingMessage, setMessageStreaming, setLoading } = useChatStore.getState()

    if (event.type === 'start') {
      // Stream started - nothing special to do
    } else if (event.type === 'delta') {
      // OpenClaw chat delta events carry the full accumulated text snapshot.
      if (event.content) {
        updateStreamingMessage(event.messageId, event.content)
      }
    } else if (event.type === 'end') {
      // Stream ended
      setMessageStreaming(event.messageId, false)
      setLoading(false)
    } else if (event.type === 'error') {
      // Error occurred
      const { updateMessage } = useChatStore.getState()
      updateMessage(event.messageId, `Error: ${event.error || 'Unknown error'}`)
      setLoading(false)
    }
  })

  // Handle connection status events
  ipc.chat.onConnected(() => {
    useChatStore.getState().setWsConnected(true)
  })

  ipc.chat.onDisconnected(() => {
    useChatStore.getState().setWsConnected(false)
  })

  ipc.chat.onError((error: string) => {
    chatLog.error('WebSocket error:', error)
  })
}
