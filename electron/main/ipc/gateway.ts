import type { IpcMain } from "electron";
import type { ConfigService } from "../services/config";
import { DEFAULT_GATEWAY_PORT } from "../constants";
import { GatewayService } from "../services/gateway";
import { resolveCommandPath } from "../utils/login-shell";
import { enrichedEnv, safeExecFile } from "../utils/safe-exec";
import { broadcastToWindows } from "./forward";

export function registerGatewayHandlers(
  ipcMain: IpcMain,
  gateway: GatewayService,
  configService: ConfigService,
): void {
  // Forward gateway status changes to all windows
  gateway.on("status-changed", (status) => {
    broadcastToWindows("gateway:status-changed", status);
  });

  const refreshGatewayConfig = async () => {
    await configService.initialize();
    const cfg = await configService.getConfig();
    if (!cfg) {
      throw new Error("Gateway config unavailable");
    }
    gateway.setConfig(cfg);
    return cfg;
  };

  ipcMain.handle("gateway:start", async () => {
    await refreshGatewayConfig();
    await gateway.start();
  });

  ipcMain.handle("gateway:stop", async () => {
    await gateway.stop();
  });

  ipcMain.handle("gateway:status", () => {
    return gateway.getStatus();
  });

  ipcMain.handle("gateway:install-service", async () => {
    const cfg = await refreshGatewayConfig();
    const port = cfg?.gateway?.port ?? DEFAULT_GATEWAY_PORT;
    if (typeof port !== "number" || port < 1 || port > 65535) {
      throw new Error(`Invalid gateway port: ${port}`);
    }
    const openclawPath = await resolveCommandPath("openclaw");
    if (!openclawPath) throw new Error("openclaw not found in PATH");
    const args = ["gateway", "install", "--force", "--port", String(port)];
    const token = cfg?.gateway?.auth?.token;
    if (token) args.push("--token", token);
    await safeExecFile(openclawPath, args, { timeoutMs: 120_000, env: enrichedEnv() });
  });

  ipcMain.handle("gateway:restart-service", async () => {
    const openclawPath = await resolveCommandPath("openclaw");
    if (!openclawPath) throw new Error("openclaw not found in PATH");
    await safeExecFile(openclawPath, ["gateway", "restart"], {
      timeoutMs: 60_000,
      env: enrichedEnv(),
    });
  });

  ipcMain.handle("gateway:uninstall-service", async () => {
    const openclawPath = await resolveCommandPath("openclaw");
    if (!openclawPath) throw new Error("openclaw not found in PATH");
    await safeExecFile(openclawPath, ["gateway", "uninstall"], {
      timeoutMs: 60_000,
      env: enrichedEnv(),
    });
  });
}
