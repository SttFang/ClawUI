import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { chatLog } from "../lib/logger";
import { ChatEventNormalizer } from "./chat-event-normalizer";
import { ChatTransport, type TransportGatewayEventFrame } from "./chat/transport";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  /**
   * Optional stable idempotency key / runId for this chat run.
   * If provided, it becomes `chat.send.params.idempotencyKey`.
   */
  messageId?: string;
  model?: string;
}

export interface ChatStreamEvent {
  type: "start" | "delta" | "end" | "error";
  sessionId: string;
  messageId: string;
  content?: string;
  error?: string;
}

export type GatewayEventFrame = TransportGatewayEventFrame;

export class ChatWebSocketService extends EventEmitter {
  private readonly transport = new ChatTransport();
  private readonly normalizer = new ChatEventNormalizer();

  constructor() {
    super();

    this.transport.on("connected", () => this.emit("connected"));
    this.transport.on("disconnected", () => this.emit("disconnected"));
    this.transport.on("error", (error: string) => this.emit("error", error));
    this.transport.on("event", (event: GatewayEventFrame) => this.handleEvent(event));
  }

  setGatewayUrl(url: string): void {
    this.transport.setGatewayUrl(url);
  }

  setGatewayToken(token: string): void {
    this.transport.setGatewayToken(token);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.transport.request(method, params);
  }

  async sendMessage(request: ChatRequest): Promise<string> {
    if (!this.transport.isConnected()) {
      throw new Error("WebSocket not connected");
    }

    const messageId = request.messageId ?? randomUUID();
    const t0 = Date.now();

    try {
      await this.request("chat.send", {
        sessionKey: request.sessionId,
        message: request.message,
        deliver: false,
        idempotencyKey: messageId,
      });

      chatLog.info(
        "[chat.send.ok]",
        `sessionId=${request.sessionId}`,
        `durationMs=${Date.now() - t0}`,
      );
      const normalizedEvents = this.normalizer.onChatSendAccepted({
        sessionKey: request.sessionId,
        clientRunId: messageId,
      });
      for (const normalizedEvent of normalizedEvents) {
        this.emit("normalized-event", normalizedEvent);
      }

      return messageId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      chatLog.warn(
        "[chat.send.failed]",
        `sessionId=${request.sessionId}`,
        message,
        `durationMs=${Date.now() - t0}`,
      );
      throw new Error(message || "Chat request failed", { cause: error });
    }
  }

  disconnect(): void {
    this.normalizer.resetAll();
    this.transport.disconnect();
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  private handleEvent(event: GatewayEventFrame): void {
    const normalizedEvents = this.normalizer.ingestGatewayEvent(event);
    for (const normalizedEvent of normalizedEvents) {
      this.emit("normalized-event", normalizedEvent);
    }

    // Forward raw Gateway events for richer renderer-side transports.
    this.emit("gateway-event", event);

    // Map OpenClaw chat events to our legacy ChatStreamEvent format.
    if (event.event !== "chat") return;

    const payload = event.payload as {
      runId?: unknown;
      sessionKey?: unknown;
      state?: unknown;
      message?: unknown;
      errorMessage?: unknown;
    };

    const runId = typeof payload?.runId === "string" ? payload.runId : null;
    const sessionKey = typeof payload?.sessionKey === "string" ? payload.sessionKey : null;
    const state = typeof payload?.state === "string" ? payload.state : null;

    if (!runId || !sessionKey || !state) return;

    const extractText = (msg: unknown): string | null => {
      if (!msg) return null;
      if (typeof msg === "string") return msg;
      if (typeof msg !== "object") return null;
      const content = (msg as { content?: unknown }).content;
      if (!Array.isArray(content) || content.length === 0) return null;
      const first = content[0] as { type?: unknown; text?: unknown } | undefined;
      if (!first || typeof first !== "object") return null;
      const text = (first as { text?: unknown }).text;
      return typeof text === "string" ? text : null;
    };

    if (state === "delta") {
      const content = extractText(payload.message);
      if (content) {
        this.emit("stream", {
          type: "delta",
          sessionId: sessionKey,
          messageId: runId,
          content,
        });
      }
      return;
    }

    if (state === "final") {
      const content = extractText(payload.message);
      if (content) {
        this.emit("stream", {
          type: "delta",
          sessionId: sessionKey,
          messageId: runId,
          content,
        });
      }
      this.emit("stream", {
        type: "end",
        sessionId: sessionKey,
        messageId: runId,
      });
      return;
    }

    if (state === "aborted") {
      this.emit("stream", {
        type: "error",
        sessionId: sessionKey,
        messageId: runId,
        error: "aborted",
      });
      return;
    }

    if (state === "error") {
      const errorMessage =
        typeof payload.errorMessage === "string" ? payload.errorMessage : "chat error";
      this.emit("stream", {
        type: "error",
        sessionId: sessionKey,
        messageId: runId,
        error: errorMessage,
      });
    }
  }
}

export const chatWebSocket = new ChatWebSocketService();
