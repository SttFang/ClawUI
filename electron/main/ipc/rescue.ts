import { BrowserWindow, ipcMain } from "electron";
import type { ChatRequest, ChatStreamEvent, GatewayEventFrame } from "../services/chat-websocket";
import type { ChatWebSocketService } from "../services/chat-websocket";
import type { ConfigService } from "../services/config";
import type { GatewayService } from "../services/gateway";
import { ensureGatewayConnected } from "../utils/ensure-connected";

export function registerRescueHandlers(
  rescueGateway: GatewayService,
  rescueChatWs: ChatWebSocketService,
  configService: ConfigService,
): void {
  // ── Gateway control ──────────────────────────────────────────────

  ipcMain.handle("rescue:gateway-start", async () => {
    await rescueGateway.start();
  });

  ipcMain.handle("rescue:gateway-stop", async () => {
    await rescueGateway.stop();
  });

  ipcMain.handle("rescue:gateway-status", () => {
    return rescueGateway.getStatus();
  });

  rescueGateway.on("status-changed", (status) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send("rescue:gateway-status-changed", status);
    });
  });

  // ── Chat / WebSocket control ─────────────────────────────────────

  ipcMain.handle("rescue:connect", async (_, url?: string) => {
    await ensureGatewayConnected(configService, rescueChatWs, url);
    return true;
  });

  ipcMain.handle("rescue:disconnect", async () => {
    rescueChatWs.disconnect();
    return true;
  });

  ipcMain.handle("rescue:send", async (_, request: ChatRequest) => {
    return rescueChatWs.sendMessage(request);
  });

  ipcMain.handle(
    "rescue:request",
    async (_, method: string, params?: Record<string, unknown>): Promise<unknown> => {
      await ensureGatewayConnected(configService, rescueChatWs);
      return rescueChatWs.request(method, params);
    },
  );

  ipcMain.handle("rescue:isConnected", () => {
    return rescueChatWs.isConnected();
  });

  // ── Event forwarding ─────────────────────────────────────────────

  const forward = (channel: string, ...args: unknown[]) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(channel, ...args);
    });
  };

  rescueChatWs.on("stream", (event: ChatStreamEvent) => forward("rescue:stream", event));
  rescueChatWs.on("gateway-event", (event: GatewayEventFrame) =>
    forward("rescue:gateway-event", event),
  );
  rescueChatWs.on("connected", () => forward("rescue:connected"));
  rescueChatWs.on("disconnected", () => forward("rescue:disconnected"));
  rescueChatWs.on("error", (error: string) => forward("rescue:error", error));
}
