import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import WebSocket from "ws";
import { DEFAULT_GATEWAY_PORT } from "../../constants";
import { chatLog } from "../../lib/logger";

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

export interface TransportGatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

type ACPMessage = ACPRequest | ACPResponse | TransportGatewayEventFrame;

type PendingRequest = {
  resolve: (response: ACPResponse) => void;
  reject: (error: Error) => void;
};

export class ChatTransport extends EventEmitter {
  private ws: WebSocket | null = null;
  private gatewayUrl = `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
  private gatewayToken = "";
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private pendingRequests = new Map<string, PendingRequest>();
  private connected = false;
  private readonly instanceId = randomUUID();
  private clientVersion = "0.1.0";

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  setGatewayToken(token: string): void {
    this.gatewayToken = token;
  }

  setClientVersion(version: string): void {
    this.clientVersion = version;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connectPromise) return this.connectPromise;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.shouldReconnect = true;

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.connected = false;
    this.connectPromise = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
  }

  async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    const requestId = randomUUID();
    const t0 = Date.now();
    const requestFrame: ACPRequest = {
      type: "req",
      id: requestId,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        chatLog.warn("[acp.request.timeout]", `method=${method}`, `durationMs=${Date.now() - t0}`);
        reject(new Error("Request timeout"));
      }, 30_000);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeout);
          if (response.ok) {
            chatLog.info("[acp.request.ok]", `method=${method}`, `durationMs=${Date.now() - t0}`);
            resolve(response.payload);
            return;
          }
          chatLog.warn(
            "[acp.request.failed]",
            `method=${method}`,
            response.error?.message,
            `durationMs=${Date.now() - t0}`,
          );
          reject(new Error(response.error?.message || `${method} failed`));
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.ws?.send(JSON.stringify(requestFrame));
    });
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      chatLog.info("[ws.connecting]", this.gatewayUrl);
      const socket = new WebSocket(this.gatewayUrl);
      this.ws = socket;

      socket.on("open", async () => {
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

      socket.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      socket.on("close", (code, reason) => {
        chatLog.info("[ws.closed]", `code=${code}`, `reason=${String(reason)}`);
        this.connected = false;
        if (this.ws === socket) {
          this.ws = null;
        }
        this.emit("disconnected");
        this.rejectAllPendingRequests(new Error("Connection closed"));
        if (this.shouldReconnect) {
          this.attemptReconnect();
        }
      });

      socket.on("error", (error) => {
        chatLog.error("[ws.error]", error.message);
        this.emit("error", error.message);
        reject(error);
      });
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
          id: "openclaw-macos",
          displayName: "ClawUI",
          version: this.clientVersion,
          platform: process.platform,
          mode: "ui",
          instanceId: this.instanceId,
        },
        scopes: ["operator.admin", "operator.approvals"],
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
      }, 10_000);

      this.pendingRequests.set(connectId, {
        resolve: (response) => {
          clearTimeout(timeout);
          if (response.ok) {
            chatLog.info("[acp.connected]", `durationMs=${Date.now() - t0}`);
            resolve();
            return;
          }
          chatLog.warn(
            "[acp.connect.rejected]",
            response.error?.message,
            `durationMs=${Date.now() - t0}`,
          );
          reject(new Error(response.error?.message || "Connect failed"));
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
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          pending.resolve(message);
        }
        return;
      }

      if (message.type === "event") {
        this.emit("event", message);
      }
    } catch (error) {
      chatLog.error("[ws.parse.error]", error);
    }
  }

  private cleanupSocket(): void {
    const socket = this.ws;
    this.ws = null;
    if (!socket) return;

    if (socket.readyState === WebSocket.CONNECTING) {
      socket.once("error", () => {});
      socket.terminate();
      return;
    }

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
      socket.close();
    }
  }

  private rejectAllPendingRequests(error: Error): void {
    for (const { reject } of this.pendingRequests.values()) {
      reject(error);
    }
    this.pendingRequests.clear();
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect || this.connectPromise || this.isConnected()) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts += 1;
    chatLog.info(
      "[ws.reconnect]",
      `attempt=${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, this.reconnectDelay * this.reconnectAttempts);
  }
}
