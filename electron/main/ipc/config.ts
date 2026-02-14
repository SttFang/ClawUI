import type { ConfigSetDraftInputV2 } from "@clawui/types/config-v2";
import type { IpcMain } from "electron";
import type { OpenClawConfigBridge } from "../services/config-bridge";
import { ConfigOrchestrator } from "../services/config-orchestrator";

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

  ipcMain.handle("config:path", () => {
    return bridge.getConfigPath();
  });
}
