// ============================================
// Chat Types
// ============================================

/**
 * Chat message role
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Chat message
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** Whether the message is being streamed */
  isStreaming?: boolean;
}

/**
 * Chat session
 */
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Chat request to Gateway
 */
export interface ChatRequest {
  sessionId: string;
  message: string;
  /**
   * Stable idempotency key / runId for this chat run.
   *
   * For OpenClaw WebChat, this value becomes `event chat.payload.runId`, which
   * lets the renderer map streaming events back to the placeholder assistant
   * message without any id-rewrite race.
   */
  messageId?: string;
  model?: string;
}

/**
 * Chat stream event types
 */
export type ChatStreamEventType = "start" | "delta" | "end" | "error";

/**
 * Chat stream event from Gateway
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  sessionId: string;
  messageId: string;
  content?: string;
  error?: string;
}
