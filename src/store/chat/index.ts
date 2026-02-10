import { create } from "zustand";
import { ipc, ChatStreamEvent } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  surface?: string | null;
}

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  isLoading: boolean;
  input: string;
  wsConnected: boolean;
}

interface ChatActions {
  createSession: (name?: string) => string;
  refreshSessions: () => Promise<void>;
  selectSession: (id: string | null) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateMessage: (id: string, content: string) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  appendMessageContent: (id: string, content: string) => void;
  setMessageStreaming: (id: string, isStreaming: boolean) => void;
  setInput: (input: string) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
  clearCurrentSession: () => void;
  connectWebSocket: (url?: string) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  input: "",
  wsConnected: false,
};

let messageIdCounter = 0;
const generateMessageId = () => `msg_${Date.now()}_${messageIdCounter++}`;

const DEFAULT_UI_SESSION_PREFIX = "agent:main:ui";
const generateUiSessionKey = () => `${DEFAULT_UI_SESSION_PREFIX}:${generateChatRunId()}`;

let chatRunIdCounter = 0;
const generateChatRunId = (): string => {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();

  // Fallback for environments without crypto.randomUUID (should still be available in Electron/Chromium):
  // generate a RFC4122 v4 UUID using getRandomValues.
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // Version 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Variant 10xx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort: stable-ish id. Prefer keeping it uuid-shaped to satisfy downstream validators.
  const t = Date.now().toString(16).padStart(12, "0");
  const c = (chatRunIdCounter++).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${t.slice(-12)}${c.slice(-12)}`.slice(0, 36);
};

export const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,

  refreshSessions: async () => {
    try {
      const payload = await ipc.chat.request("sessions.list", {
        limit: 50,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });

      const sessions = parseSessionsListPayload(payload);
      if (sessions.length === 0) return;

      // Merge into existing sessions to preserve any local UI state (e.g. in-memory messages).
      const prevById = new Map(get().sessions.map((s) => [s.id, s]));
      const merged = sessions.map((remote, idx) => {
        const prev = prevById.get(remote.id);
        if (prev) {
          return {
            ...prev,
            name: remote.name,
            updatedAt: remote.updatedAt,
          };
        }
        return {
          ...remote,
          name: remote.name || `Session ${idx + 1}`,
          messages: [],
        } satisfies Session;
      });

      set((state) => ({
        sessions: merged,
        currentSessionId: state.currentSessionId ?? merged[0]?.id ?? null,
      }));
    } catch (error) {
      chatLog.warn("Failed to refresh sessions from gateway:", error);
    }
  },

  createSession: (name) => {
    const id = generateUiSessionKey();
    const now = Date.now();
    const session: Session = {
      id,
      name: name || `Session ${get().sessions.length + 1}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      sessions: [...state.sessions, session],
      currentSessionId: id,
    }));
    return id;
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
        s.id === id ? { ...s, name, updatedAt: Date.now() } : s,
      ),
    })),

  addMessage: (message) => {
    const { currentSessionId, createSession } = get();
    let sessionId = currentSessionId;

    // Create a new session if none exists
    if (!sessionId) {
      sessionId = createSession();
    }

    const newMessage: Message = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    };

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              messages: [...s.messages, newMessage],
              updatedAt: Date.now(),
            }
          : s,
      ),
    }));
  },

  updateMessage: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === id ? { ...m, content, isStreaming: false } : m)),
      })),
    })),

  updateStreamingMessage: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => {
          if (m.id !== id) return m;
          // OpenClaw chat delta payloads are cumulative; avoid regressing to shorter snapshots.
          if (!m.content || content.length >= m.content.length) {
            return { ...m, content };
          }
          return m;
        }),
      })),
    })),

  appendMessageContent: (id, content) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + content } : m)),
      })),
    })),

  setMessageStreaming: (id, isStreaming) =>
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === id ? { ...m, isStreaming } : m)),
      })),
    })),

  setInput: (input) => set({ input }),
  setLoading: (isLoading) => set({ isLoading }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  connectWebSocket: async (url) => {
    try {
      await ipc.chat.connect(url);
    } catch (error) {
      chatLog.error("Failed to connect WebSocket:", error);
    }
  },

  disconnectWebSocket: async () => {
    try {
      await ipc.chat.disconnect();
    } catch (error) {
      chatLog.error("Failed to disconnect WebSocket:", error);
    }
  },

  sendMessage: async (content) => {
    const { addMessage, setLoading, updateMessage, currentSessionId, createSession, wsConnected } =
      get();

    // Create session if needed
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession();
    }

    // Add user message
    addMessage({ role: "user", content });
    set({ input: "" });
    setLoading(true);

    // Add placeholder assistant message
    const runId = generateChatRunId();
    set((state) => {
      const sid = state.currentSessionId;
      if (!sid) return state;

      return {
        sessions: state.sessions.map((s) =>
          s.id === sid
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  {
                    id: runId,
                    role: "assistant" as const,
                    content: "",
                    timestamp: Date.now(),
                    isStreaming: true,
                  },
                ],
                updatedAt: Date.now(),
              }
            : s,
        ),
      };
    });

    try {
      if (wsConnected) {
        await ipc.chat.send({
          sessionId: sessionId!,
          message: content,
          messageId: runId,
        });
      } else {
        // Fallback to simulated response when WebSocket is not connected
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateMessage(runId, "WebSocket not connected. Please connect to the gateway first.");
        setLoading(false);
      }
    } catch (error) {
      chatLog.error("Failed to send message:", error);
      updateMessage(runId, "Error: Failed to send message to gateway.");
      setLoading(false);
    }
  },

  clearCurrentSession: () =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === state.currentSessionId ? { ...s, messages: [], updatedAt: Date.now() } : s,
      ),
    })),
}));

// Selectors - use stable references to prevent infinite re-renders in React 19
export const selectCurrentSession = (state: ChatStore): Session | undefined =>
  state.sessions.find((s) => s.id === state.currentSessionId);

const EMPTY_MESSAGES: Message[] = [];
export const selectMessages = (state: ChatStore): Message[] => {
  const session = state.sessions.find((s) => s.id === state.currentSessionId);
  return session?.messages ?? EMPTY_MESSAGES;
};

export const selectSessions = (state: ChatStore) => state.sessions;
export const selectIsLoading = (state: ChatStore) => state.isLoading;
export const selectInput = (state: ChatStore) => state.input;
export const selectWsConnected = (state: ChatStore) => state.wsConnected;

// Initialize WebSocket stream listener
let chatStreamListenerInitialized = false;
export function initChatStreamListener() {
  if (chatStreamListenerInitialized || typeof window === "undefined") return;
  chatStreamListenerInitialized = true;

  // Handle stream events
  ipc.chat.onStream((event: ChatStreamEvent) => {
    const { updateStreamingMessage, setMessageStreaming, setLoading } = useChatStore.getState();

    if (event.type === "start") {
      // Stream started - nothing special to do
    } else if (event.type === "delta") {
      // OpenClaw chat delta events carry the full accumulated text snapshot.
      if (event.content) {
        updateStreamingMessage(event.messageId, event.content);
      }
    } else if (event.type === "end") {
      // Stream ended
      setMessageStreaming(event.messageId, false);
      setLoading(false);
    } else if (event.type === "error") {
      // Error occurred
      const { updateMessage } = useChatStore.getState();
      updateMessage(event.messageId, `Error: ${event.error || "Unknown error"}`);
      setLoading(false);
    }
  });

  // Handle connection status events
  ipc.chat.onConnected(() => {
    useChatStore.getState().setWsConnected(true);
  });

  ipc.chat.onDisconnected(() => {
    useChatStore.getState().setWsConnected(false);
  });

  ipc.chat.onError((error: string) => {
    chatLog.error("WebSocket error:", error);
  });
}

function parseSessionsListPayload(
  payload: unknown,
): Array<Pick<Session, "id" | "name" | "createdAt" | "updatedAt" | "surface">> {
  if (!payload || typeof payload !== "object") return [];
  const sessionsValue = (payload as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessionsValue)) return [];

  const out: Array<Pick<Session, "id" | "name" | "createdAt" | "updatedAt" | "surface">> = [];
  for (const item of sessionsValue) {
    if (!item || typeof item !== "object") continue;
    const key = (item as { key?: unknown }).key;
    if (typeof key !== "string" || !key.trim()) continue;

    const derivedTitle = (item as { derivedTitle?: unknown }).derivedTitle;
    const updatedAt = (item as { updatedAt?: unknown }).updatedAt;
    const surface = (item as { surface?: unknown }).surface;

    out.push({
      id: key,
      name: typeof derivedTitle === "string" && derivedTitle.trim() ? derivedTitle : key,
      createdAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
      updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
      surface: typeof surface === "string" ? surface : null,
    });
  }

  // Newest first
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}
