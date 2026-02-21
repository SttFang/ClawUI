import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { ALLOWED_CHAT_METHODS } from "@clawui/constants";
import type { ChatWebSocketService, ChatRequest } from "../services/chat/chat-websocket";
import type { ConfigService } from "../services/config";
import { ensureGatewayConnected } from "../utils/ensure-connected";
import { forwardToWindow } from "./forward";

export function registerChatHandlers(
  mainWindow: BrowserWindow,
  configService: ConfigService,
  chatWebSocket: ChatWebSocketService,
): void {
  ipcMain.handle("chat:connect", async (_, url?: string) => {
    await ensureGatewayConnected(configService, chatWebSocket, url);
    return true;
  });

  ipcMain.handle("chat:disconnect", async () => {
    chatWebSocket.disconnect();
    return true;
  });

  ipcMain.handle("chat:send", async (_, request: ChatRequest) => {
    return chatWebSocket.sendMessage(request);
  });

  ipcMain.handle(
    "chat:request",
    async (_, method: string, params?: Record<string, unknown>): Promise<unknown> => {
      if (!ALLOWED_CHAT_METHODS.has(method)) {
        throw new Error(`Disallowed ACP method: ${method}`);
      }
      await ensureGatewayConnected(configService, chatWebSocket);
      return chatWebSocket.request(method, params);
    },
  );

  ipcMain.handle("chat:isConnected", () => {
    return chatWebSocket.isConnected();
  });

  // Forward all events to main window
  forwardToWindow(chatWebSocket, mainWindow, {
    stream: "chat:stream",
    "gateway-event": "gateway:event",
    "normalized-event": "chat:normalized-event",
    connected: "chat:connected",
    reconnected: "chat:reconnected",
    disconnected: "chat:disconnected",
    error: "chat:error",
  });
}
