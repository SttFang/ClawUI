import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { DeviceIdentity } from "./device-identity";
import { chatLog } from "../../lib/logger";
import { ChatEventAdapter } from "./event-adapter";
import { ChatTransport, type TransportGatewayEventFrame } from "./transport";

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
  private readonly normalizer = new ChatEventAdapter();

  constructor() {
    super();

    this.transport.on("connected", () => this.emit("connected"));
    this.transport.on("reconnected", () => this.emit("reconnected"));
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

  setClientVersion(version: string): void {
    this.transport.setClientVersion(version);
  }

  setDeviceIdentity(identity: DeviceIdentity): void {
    this.transport.setDeviceIdentity(identity);
  }

  async connect(): Promise<void> {
    await this.transport.connect();
  }

  async request(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<unknown> {
    const gatewayParams =
      method === "exec.approval.resolve" && params
        ? {
            id: params.id,
            decision: params.decision,
          }
        : params;
    const payload = await this.transport.request(method, gatewayParams, timeoutMs);

    if (method === "exec.approval.resolve" && params) {
      const approvalId = typeof params.id === "string" ? params.id : undefined;
      const decisionRaw = params.decision;
      const decision =
        decisionRaw === "allow-once" || decisionRaw === "allow-always" || decisionRaw === "deny"
          ? decisionRaw
          : undefined;
      const normalizedEvents = this.normalizer.onApprovalResolveRequest({
        approvalId,
        decision,
        sessionKey: typeof params.sessionKey === "string" ? params.sessionKey : undefined,
        commandHint: typeof params.command === "string" ? params.command : undefined,
        traceId: typeof params.traceId === "string" ? params.traceId : undefined,
        runId: typeof params.runId === "string" ? params.runId : undefined,
        toolCallId: typeof params.toolCallId === "string" ? params.toolCallId : undefined,
      });
      for (const normalizedEvent of normalizedEvents) {
        this.emit("normalized-event", normalizedEvent);
      }
    }

    return payload;
  }

  async sendMessage(request: ChatRequest): Promise<string> {
    if (!this.transport.isConnected()) {
      throw new Error("WebSocket not connected");
    }

    const messageId = request.messageId ?? randomUUID();
    const t0 = Date.now();

    try {
      const payload = (await this.request("chat.send", {
        sessionKey: request.sessionId,
        message: request.message,
        deliver: false,
        idempotencyKey: messageId,
      })) as { runId?: unknown } | undefined;
      const ackRunId =
        typeof payload?.runId === "string" && payload.runId.trim()
          ? payload.runId.trim()
          : messageId;
      if (ackRunId !== messageId) {
        chatLog.warn(
          "[chat.send.runid_mismatch]",
          `sessionId=${request.sessionId}`,
          `idempotencyKey=${messageId}`,
          `ackRunId=${ackRunId}`,
        );
      }

      chatLog.info(
        "[chat.send.ok]",
        `sessionId=${request.sessionId}`,
        `runId=${ackRunId}`,
        `durationMs=${Date.now() - t0}`,
      );
      const normalizedEvents = this.normalizer.onChatSendAccepted({
        sessionKey: request.sessionId,
        clientRunId: ackRunId,
      });
      for (const normalizedEvent of normalizedEvents) {
        this.emit("normalized-event", normalizedEvent);
      }

      return ackRunId;
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
