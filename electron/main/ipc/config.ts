import type { ConfigSetDraftInputV2 } from "@clawui/types/config-v2";
import type { IpcMain } from "electron";
import { configLog } from "../lib/logger";
import { OpenClawConfigBridge, type LegacyOpenClawConfig } from "../services/config-bridge";
import { ConfigOrchestrator } from "../services/config-orchestrator";

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

function isDraftPayload(value: unknown): value is ConfigSetDraftInputV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const raw = (value as { raw?: unknown }).raw;
  const baseHash = (value as { baseHash?: unknown }).baseHash;
  return typeof raw === "string" && typeof baseHash === "string";
}

export function registerConfigHandlers(
  ipcMain: IpcMain,
  bridge: OpenClawConfigBridge,
  orchestrator: ConfigOrchestrator,
): void {
  ipcMain.handle("config:get", async () => {
    return bridge.getLegacyConfig();
  });

  ipcMain.handle("config:snapshot", async () => {
    return orchestrator.getSnapshot();
  });

  ipcMain.handle("config:schema", async () => {
    return orchestrator.getSchema();
  });

  ipcMain.handle("config:set-draft", async (_event, raw: unknown) => {
    if (!isDraftPayload(raw)) {
      return {
        ok: false,
        error: {
          code: "CONFIG_INVALID_RAW",
          message: "invalid config draft payload",
        },
      } as const;
    }
    return orchestrator.setDraft(raw);
  });

  ipcMain.handle("config:set", async (_event, raw: unknown) => {
    if (isDraftPayload(raw)) {
      return orchestrator.setDraft(raw);
    }

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
