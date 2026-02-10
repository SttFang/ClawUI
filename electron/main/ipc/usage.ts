import { ipcMain } from "electron";
import type { ConfigService } from "../services/config";
import { chatWebSocket } from "../services/chat-websocket";
import { ensureGatewayConnected } from "../utils/ensure-connected";

export function registerUsageHandlers(configService: ConfigService): void {
  ipcMain.handle("usage:sessions", async (_, params?: Record<string, unknown>) => {
    await ensureGatewayConnected(configService);
    return chatWebSocket.request("sessions.usage", params);
  });

  ipcMain.handle("usage:cost", async (_, params?: Record<string, unknown>) => {
    await ensureGatewayConnected(configService);
    return chatWebSocket.request("usage.cost", params);
  });

  ipcMain.handle("usage:timeseries", async (_, params?: Record<string, unknown>) => {
    await ensureGatewayConnected(configService);
    return chatWebSocket.request("sessions.usage.timeseries", params);
  });

  ipcMain.handle("usage:logs", async (_, params?: Record<string, unknown>) => {
    await ensureGatewayConnected(configService);
    return chatWebSocket.request("sessions.usage.logs", params);
  });
}
