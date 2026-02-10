import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import WebSocket from "ws";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { chatLog } from "../lib/logger";

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

// OpenClaw ACP Protocol Types
interface ACPRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface ACPResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message: string; code?: string };
}

export interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

type ACPMessage = ACPRequest | ACPResponse | GatewayEventFrame;

export class ChatWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private gatewayUrl: string = `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
  private gatewayToken: string = "";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pendingRequests: Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  > = new Map();
  private connected = false;

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  setGatewayToken(token: string): void {
    this.gatewayToken = token;
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  async connect(): Promise<void> {
    this.cleanupSocket();

    return new Promise((resolve, reject) => {
      try {
        const t0 = Date.now();
        chatLog.info("[ws.connecting]", this.gatewayUrl);
        this.ws = new WebSocket(this.gatewayUrl);

        this.ws.on("open", async () => {
          chatLog.info("[ws.open]", `durationMs=${Date.now() - t0}`);
          try {
            await this.sendConnectFrame();
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit("connected");
            chatLog.info("[ws.connected]", `durationMs=${Date.now() - t0}`);
            resolve();
          } catch (error) {
            chatLog.error("[acp.connect.failed]", error);
            this.ws?.close();
            reject(error);
          }
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on("close", (code, reason) => {
          chatLog.info("[ws.closed]", `code=${code}`, `reason=${String(reason)}`);
          this.connected = false;
          this.emit("disconnected");
          // Reject all pending requests
          for (const [, { reject }] of this.pendingRequests) {
            reject(new Error("Connection closed"));
          }
          this.pendingRequests.clear();
          this.attemptReconnect();
        });

        this.ws.on("error", (error) => {
          chatLog.error("[ws.error]", error.message);
          this.emit("error", error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async sendConnectFrame(): Promise<void> {
    const connectId = randomUUID();
    const t0 = Date.now();

    const connectRequest: ACPRequest = {
      type: "req",
      id: connectId,
      method: "connect",
      params: {
        minProtocol: 1,
        maxProtocol: 3,
        client: {
          id: "cli", // Use CLI - trusted local client, no origin check needed
          version: "0.1.0",
          platform: process.platform,
          mode: "cli",
        },
        // Required for exec approval events + resolve calls.
        scopes: ["operator.admin", "operator.approvals"],
        // Enable enhanced streaming features (e.g. tool call events).
        caps: ["tool-events"],
        auth: {
          token: this.gatewayToken,
        },
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(connectId);
        reject(new Error("Connect timeout"));
      }, 10000);

      this.pendingRequests.set(connectId, {
        resolve: (response) => {
          clearTimeout(timeout);
          const res = response as ACPResponse;
          if (res.ok) {
            chatLog.info("[acp.connected]", `durationMs=${Date.now() - t0}`);
            resolve();
          } else {
            chatLog.warn(
              "[acp.connect.rejected]",
              res.error?.message,
              `durationMs=${Date.now() - t0}`,
            );
            reject(new Error(res.error?.message || "Connect failed"));
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      chatLog.debug("[acp.connect.send]");
      this.ws?.send(JSON.stringify(connectRequest));
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ACPMessage;

      if (message.type === "res") {
        // Handle response to a request
        const response = message as ACPResponse;
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } else if (message.type === "event") {
        // Handle server events
        const event = message as GatewayEventFrame;
        this.handleEvent(event);
      }
    } catch (e) {
      chatLog.error("[ws.parse.error]", e);
    }
  }

  private handleEvent(event: GatewayEventFrame): void {
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
        // Ensure the renderer sees the final full content before we end the stream.
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
      return;
    }

    return;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      chatLog.info(
        "[ws.reconnect]",
        `attempt=${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      );
      setTimeout(() => {
        this.connect().catch(() => {});
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    const requestId = randomUUID();
    const t0 = Date.now();

    const acpRequest: ACPRequest = {
      type: "req",
      id: requestId,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        chatLog.warn(`[acp.request.timeout]`, `method=${method}`, `durationMs=${Date.now() - t0}`);
        reject(new Error("Request timeout"));
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          const res = response as ACPResponse;
          if (res.ok) {
            chatLog.info(`[acp.request.ok]`, `method=${method}`, `durationMs=${Date.now() - t0}`);
            resolve(res.payload);
          } else {
            chatLog.warn(
              `[acp.request.failed]`,
              `method=${method}`,
              res.error?.message,
              `durationMs=${Date.now() - t0}`,
            );
            reject(new Error(res.error?.message || `${method} failed`));
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws?.send(JSON.stringify(acpRequest));
    });
  }

  async sendMessage(request: ChatRequest): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    // Use a stable runId/idempotency key so we can map streaming events back to a renderer message.
    const messageId = request.messageId ?? randomUUID();
    const requestId = randomUUID();
    const t0 = Date.now();

    // OpenClaw Gateway v2026 uses `chat.send` + `chat` events for streaming.
    const acpRequest: ACPRequest = {
      type: "req",
      id: requestId,
      method: "chat.send",
      params: {
        sessionKey: request.sessionId,
        message: request.message,
        deliver: false,
        idempotencyKey: messageId,
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        chatLog.warn(
          "[chat.send.timeout]",
          `sessionId=${request.sessionId}`,
          `durationMs=${Date.now() - t0}`,
        );
        reject(new Error("Request timeout"));
      }, 30000);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          const res = response as ACPResponse;
          if (res.ok) {
            chatLog.info(
              "[chat.send.ok]",
              `sessionId=${request.sessionId}`,
              `durationMs=${Date.now() - t0}`,
            );
            resolve(messageId);
          } else {
            chatLog.warn(
              "[chat.send.failed]",
              `sessionId=${request.sessionId}`,
              res.error?.message,
              `durationMs=${Date.now() - t0}`,
            );
            reject(new Error(res.error?.message || "Chat request failed"));
          }
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws?.send(JSON.stringify(acpRequest));
    });
  }

  disconnect(): void {
    this.connected = false;
    this.cleanupSocket();
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const chatWebSocket = new ChatWebSocketService();
