import type { IpcMain } from "electron";
import type { OpenClawProfilesService } from "../services/openclaw-profiles";

const ALLOWED_SECRET_ENV_KEYS = new Set<string>([
  // Discord
  "DISCORD_BOT_TOKEN",
  "DISCORD_APP_TOKEN",

  // Telegram
  "TELEGRAM_BOT_TOKEN",

  // Slack
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
]);

function validatePatch(patch: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED_SECRET_ENV_KEYS.has(key)) {
      throw new Error(`Secret key not allowed: ${key}`);
    }
    if (value === null) {
      out[key] = null;
      continue;
    }
    if (typeof value !== "string") {
      throw new Error(`Secret value must be a string or null: ${key}`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      out[key] = null;
      continue;
    }
    if (trimmed.length > 4096) throw new Error(`Secret value too long: ${key}`);
    out[key] = trimmed;
  }
  return out;
}

export function registerSecretsHandlers(ipcMain: IpcMain, profiles: OpenClawProfilesService): void {
  ipcMain.handle("secrets:patch", async (_event, patch: Record<string, unknown>) => {
    const validated = validatePatch(patch);
    await profiles.patchEnvBoth(validated);
  });
}
