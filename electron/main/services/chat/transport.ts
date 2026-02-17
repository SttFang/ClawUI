import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import WebSocket from "ws";
import type { DeviceIdentity } from "./device-identity";
import { DEFAULT_GATEWAY_PORT } from "../../constants";
import { chatLog } from "../../lib/logger";
import {
  buildConnectFrame,
  handleConnectResponsePayload,
  extractChallengeNonce,
} from "./acp-connect";

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
  private backoffMs = 1000;
  private lastTick: number | null = null;
  private tickIntervalMs = 30_000;
  private tickTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPromise: Promise<void> | null = null;
  private shouldReconnect = true;
  private pendingRequests = new Map<string, PendingRequest>();
  private connected = false;
  private readonly instanceId = randomUUID();
  private clientVersion = "0.1.0";

  private deviceIdentity: DeviceIdentity | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: NodeJS.Timeout | null = null;
  private doConnectCallbacks: {
    resolve: () => void;
    reject: (err: Error) => void;
    t0: number;
  } | null = null;

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  setGatewayToken(token: string): void {
    this.gatewayToken = token;
  }

  setClientVersion(version: string): void {
    this.clientVersion = version;
  }

  setDeviceIdentity(identity: DeviceIdentity): void {
    this.deviceIdentity = identity;
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
    this.lastTick = null;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
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
            `code=${response.error?.code ?? "unknown"}`,
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

      socket.on("open", () => {
        chatLog.info("[ws.open]", `durationMs=${Date.now() - t0}`);
        this.doConnectCallbacks = { resolve, reject, t0 };
        this.queueConnect();
      });

      socket.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      socket.on("close", (code, reason) => {
        chatLog.info("[ws.closed]", `code=${code}`, `reason=${String(reason)}`);
        this.connected = false;
        this.lastTick = null;
        if (this.tickTimer) {
          clearInterval(this.tickTimer);
          this.tickTimer = null;
        }
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

  private queueConnect(): void {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      this.sendConnectFrame();
    }, 750);
  }

  private sendConnectFrame(): void {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const { frame, connectId } = buildConnectFrame({
      clientVersion: this.clientVersion,
      instanceId: this.instanceId,
      gatewayToken: this.gatewayToken,
      deviceIdentity: this.deviceIdentity,
      nonce: this.connectNonce,
    });

    const callbacks = this.doConnectCallbacks;
    const t0 = callbacks?.t0 ?? Date.now();

    const timeout = setTimeout(() => {
      this.pendingRequests.delete(connectId);
      const err = new Error("Connect timeout");
      callbacks?.reject(err);
      this.doConnectCallbacks = null;
    }, 10_000);

    this.pendingRequests.set(connectId, {
      resolve: (response) => {
        clearTimeout(timeout);
        if (response.ok) {
          chatLog.info("[acp.connected]", `durationMs=${Date.now() - t0}`);
          handleConnectResponsePayload(response.payload, "operator", this.deviceIdentity);
          const helloPayload = response.payload as Record<string, unknown> | undefined;
          const policy = helloPayload?.policy as Record<string, unknown> | undefined;
          if (typeof policy?.tickIntervalMs === "number")
            this.tickIntervalMs = policy.tickIntervalMs;
          this.lastTick = Date.now();
          this.backoffMs = 1000;
          this.startTickWatch();
          this.connected = true;
          this.emit("connected");
          chatLog.info("[ws.connected]", `durationMs=${Date.now() - t0}`);
          callbacks?.resolve();
        } else {
          chatLog.warn(
            "[acp.connect.rejected]",
            response.error?.message,
            `durationMs=${Date.now() - t0}`,
          );
          callbacks?.reject(new Error(response.error?.message || "Connect failed"));
          this.ws?.close();
        }
        this.doConnectCallbacks = null;
      },
      reject: (error) => {
        clearTimeout(timeout);
        callbacks?.reject(error);
        this.doConnectCallbacks = null;
      },
    });

    chatLog.debug("[acp.connect.send]", this.deviceIdentity ? "device=yes" : "device=no");
    this.ws?.send(JSON.stringify(frame));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ACPMessage;

      if (message.type === "event") {
        if (!this.connected && message.event === "connect.challenge") {
          const nonce = extractChallengeNonce(message.payload);
          if (nonce) {
            chatLog.debug("[acp.challenge]", `nonce=${nonce.slice(0, 8)}...`);
            this.connectNonce = nonce;
            this.sendConnectFrame();
          }
          return;
        }
        if (message.event === "tick") {
          this.lastTick = Date.now();
        }
        this.emit("event", message);
        return;
      }

      if (message.type === "res") {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          pending.resolve(message);
        }
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
      socket.once("error", (err) => {
        chatLog.debug("[transport.cleanup.ignored]", err);
      });
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

  private startTickWatch(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (!this.lastTick) return;
      if (Date.now() - this.lastTick > this.tickIntervalMs * 2) {
        chatLog.warn("[tick.timeout]", `gap=${Date.now() - this.lastTick}ms`);
        this.ws?.close(4000, "tick timeout");
      }
    }, interval);
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect || this.connectPromise || this.isConnected()) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
    chatLog.info("[ws.reconnect]", `delay=${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        chatLog.debug("[transport.reconnect.ignored]", err);
      });
    }, delay);
  }
}
