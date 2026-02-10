import { IpcMain, BrowserWindow } from "electron";
import type { ConfigService } from "../services/config";
import { GatewayService } from "../services/gateway";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { execInLoginShell } from "../utils/login-shell";

function shEscape(value: string): string {
  // Single-quote escape for POSIX shells.
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function registerGatewayHandlers(
  ipcMain: IpcMain,
  gateway: GatewayService,
  configService: ConfigService,
): void {
  // Forward gateway status changes to all windows
  gateway.on("status-changed", (status) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send("gateway:status-changed", status);
      }
    });
  });

  ipcMain.handle("gateway:start", async () => {
    await gateway.start();
  });

  ipcMain.handle("gateway:stop", async () => {
    await gateway.stop();
  });

  ipcMain.handle("gateway:status", () => {
    return gateway.getStatus();
  });

  ipcMain.handle("gateway:websocket-url", () => {
    return gateway.getWebSocketUrl();
  });

  ipcMain.handle("gateway:install-service", async () => {
    const cfg = await configService.getConfig();
    const port = cfg?.gateway?.port ?? DEFAULT_GATEWAY_PORT;
    if (typeof port !== "number" || port < 1 || port > 65535) {
      throw new Error(`Invalid gateway port: ${port}`);
    }
    const token = cfg?.gateway?.auth?.token;
    const cmd = [
      "openclaw gateway install --force",
      `--port ${port}`,
      token ? `--token ${shEscape(token)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    await execInLoginShell(cmd, { timeoutMs: 120_000 });
  });

  ipcMain.handle("gateway:restart-service", async () => {
    await execInLoginShell("openclaw gateway restart", { timeoutMs: 60_000 });
  });

  ipcMain.handle("gateway:uninstall-service", async () => {
    await execInLoginShell("openclaw gateway uninstall", { timeoutMs: 60_000 });
  });
}
