import type { ChatNormalizedRunEvent } from "@clawui/types";
import { ipcMain, BrowserWindow } from "electron";
import {
  chatWebSocket,
  ChatRequest,
  ChatStreamEvent,
  type GatewayEventFrame,
} from "../services/chat-websocket";
import { ConfigService } from "../services/config";
import { ensureGatewayConnected } from "../utils/ensure-connected";

export function registerChatHandlers(
  mainWindow: BrowserWindow,
  configService: ConfigService,
): void {
  // Connect to WebSocket
  ipcMain.handle("chat:connect", async (_, url?: string) => {
    await ensureGatewayConnected(configService, url);
    return true;
  });

  // Disconnect from WebSocket
  ipcMain.handle("chat:disconnect", async () => {
    chatWebSocket.disconnect();
    return true;
  });

  // Send message
  ipcMain.handle("chat:send", async (_, request: ChatRequest) => {
    return chatWebSocket.sendMessage(request);
  });

  // Generic ACP request (e.g. sessions.list / sessions.preview).
  ipcMain.handle(
    "chat:request",
    async (_, method: string, params?: Record<string, unknown>): Promise<unknown> => {
      await ensureGatewayConnected(configService);
      return chatWebSocket.request(method, params);
    },
  );

  // Check connection status
  ipcMain.handle("chat:isConnected", () => {
    return chatWebSocket.isConnected();
  });

  // Forward stream events to renderer
  chatWebSocket.on("stream", (event: ChatStreamEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:stream", event);
    }
  });

  // Forward raw Gateway events to renderer (used by richer streaming transports / UI).
  chatWebSocket.on("gateway-event", (event: GatewayEventFrame) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gateway:event", event);
    }
  });

  chatWebSocket.on("normalized-event", (event: ChatNormalizedRunEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:normalized-event", event);
    }
  });

  chatWebSocket.on("connected", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:connected");
    }
  });

  chatWebSocket.on("disconnected", () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:disconnected");
    }
  });

  chatWebSocket.on("error", (error: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("chat:error", error);
    }
  });
}
