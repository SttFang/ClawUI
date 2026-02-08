import { create } from 'zustand'

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
}

interface ChatActions {
  createSession: (name?: string) => string
  selectSession: (id: string | null) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, name: string) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  setInput: (input: string) => void
  setLoading: (loading: boolean) => void
  sendMessage: (content: string) => Promise<void>
  clearCurrentSession: () => void
}

type ChatStore = ChatState & ChatActions

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  input: '',
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

  setInput: (input) => set({ input }),
  setLoading: (isLoading) => set({ isLoading }),

  sendMessage: async (content) => {
    const { addMessage, setLoading, updateMessage } = get()

    // Add user message
    addMessage({ role: 'user', content })
    set({ input: '' })
    setLoading(true)

    // Add placeholder assistant message
    const assistantMessageId = generateMessageId()
    set((state) => {
      const sessionId = state.currentSessionId
      if (!sessionId) return state

      return {
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: assistantMessageId,
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
      // TODO: Connect to OpenClaw Gateway WebSocket
      // For now, simulate a response
      await new Promise((resolve) => setTimeout(resolve, 1000))
      updateMessage(assistantMessageId, 'This is a simulated response. Connect to OpenClaw Gateway for real responses.')
    } catch {
      updateMessage(assistantMessageId, 'Error: Failed to get response from gateway.')
    } finally {
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
