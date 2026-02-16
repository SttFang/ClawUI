import type { IpcMain } from "electron";
import type { CredentialService } from "../services/credentials";
import type { OpenClawProfilesService } from "../services/openclaw-profiles";

const SECRET_REGISTRY: Record<
  string,
  { channelType: string; tokenField: "botToken" | "appToken" }
> = {
  DISCORD_BOT_TOKEN: { channelType: "discord", tokenField: "botToken" },
  DISCORD_APP_TOKEN: { channelType: "discord", tokenField: "appToken" },
  TELEGRAM_BOT_TOKEN: { channelType: "telegram", tokenField: "botToken" },
  SLACK_BOT_TOKEN: { channelType: "slack", tokenField: "botToken" },
  SLACK_APP_TOKEN: { channelType: "slack", tokenField: "appToken" },
};

const ALLOWED_SECRET_ENV_KEYS = new Set(Object.keys(SECRET_REGISTRY));

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

export function registerSecretsHandlers(
  ipcMain: IpcMain,
  profiles: OpenClawProfilesService,
  credentialService?: CredentialService,
): void {
  ipcMain.handle("secrets:patch", async (_, patch: Record<string, unknown>) => {
    const validated = validatePatch(patch);

    if (credentialService) {
      for (const [key, value] of Object.entries(validated)) {
        const mapping = SECRET_REGISTRY[key];
        if (mapping) {
          await credentialService.setChannelToken({
            channelType: mapping.channelType,
            tokenField: mapping.tokenField,
            value: value ?? "",
          });
        }
      }
    } else {
      await profiles.patchEnvBoth(validated);
    }
  });
}
