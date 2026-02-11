import type { IpcMain } from "electron";
import { configLog } from "../lib/logger";
import { OpenClawConfigBridge, type LegacyOpenClawConfig } from "../services/config-bridge";

/** Only these top-level keys may be set from the renderer. */
type AllowedConfigKey = "gateway" | "agents" | "session" | "channels" | "tools" | "cron" | "hooks";

const ALLOWED_CONFIG_KEYS: ReadonlySet<AllowedConfigKey> = new Set([
  "gateway",
  "agents",
  "session",
  "channels",
  "tools",
  "cron",
  "hooks",
]);

function sanitizeConfigInput(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWED_CONFIG_KEYS.has(key as AllowedConfigKey)) {
      filtered[key] = value;
    } else {
      configLog.warn("[config.set] rejected unknown key:", key);
    }
  }
  return Object.keys(filtered).length > 0 ? filtered : null;
}

export function registerConfigHandlers(ipcMain: IpcMain, bridge: OpenClawConfigBridge): void {
  ipcMain.handle("config:get", async () => {
    return bridge.getLegacyConfig();
  });

  ipcMain.handle("config:set", async (_event, raw: unknown) => {
    const config = sanitizeConfigInput(raw);
    if (!config) {
      configLog.warn("[config.set] rejected invalid input");
      return;
    }
    await bridge.applyLegacyPatch(config as Partial<LegacyOpenClawConfig>);
  });

  ipcMain.handle("config:path", () => {
    return bridge.getConfigPath();
  });
}
