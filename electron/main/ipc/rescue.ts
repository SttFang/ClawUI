import { ipcMain } from "electron";
import { ALLOWED_RESCUE_METHODS } from "@clawui/constants/ipc-methods";
import type { ChatRequest } from "../services/chat-websocket";
import type { ChatWebSocketService } from "../services/chat-websocket";
import type { ConfigService } from "../services/config";
import type { GatewayService } from "../services/gateway";
import { ensureGatewayConnected } from "../utils/ensure-connected";
import { broadcastToWindows, forwardToAll } from "./forward";

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
    broadcastToWindows("rescue:gateway-status-changed", status);
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
      if (!ALLOWED_RESCUE_METHODS.has(method)) {
        throw new Error(`Disallowed ACP method: ${method}`);
      }
      await ensureGatewayConnected(configService, rescueChatWs);
      return rescueChatWs.request(method, params);
    },
  );

  ipcMain.handle("rescue:isConnected", () => {
    return rescueChatWs.isConnected();
  });

  // ── Event forwarding — broadcast to all windows ────────────────

  forwardToAll(rescueChatWs, {
    stream: "rescue:stream",
    "gateway-event": "rescue:gateway-event",
    connected: "rescue:connected",
    reconnected: "rescue:reconnected",
    disconnected: "rescue:disconnected",
    error: "rescue:error",
  });
}
