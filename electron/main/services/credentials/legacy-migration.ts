import type { ConfigService } from "../config";
import type { AuthProfileAdapter } from "./auth-profile-adapter";
import { configLog } from "../../lib/logger";
import { getNestedValue } from "../config";
import {
  ENV_ANTHROPIC_API_KEY,
  ENV_OPENAI_API_KEY,
  LEGACY_CHANNEL_ENV_MAP,
} from "./credential-defs";
import { credentialHasValue, profileIdForProvider } from "./credential-helpers";

export async function migrateLegacyKeys(
  configService: ConfigService,
  authProfiles: AuthProfileAdapter,
): Promise<void> {
  const config = await configService.getConfig();
  if (!config?.env) return;

  // LLM keys: env → auth-profiles
  const llmMigrations: Array<{ envKey: string; provider: string }> = [
    { envKey: ENV_ANTHROPIC_API_KEY, provider: "anthropic" },
    { envKey: ENV_OPENAI_API_KEY, provider: "openai" },
  ];

  for (const { envKey, provider } of llmMigrations) {
    const envValue = config.env[envKey];
    if (!envValue) continue;

    const profileId = profileIdForProvider(provider);
    const existing = await authProfiles.getProfile(profileId);
    if (existing && credentialHasValue(existing)) continue;

    await authProfiles.setProfile(profileId, {
      type: "api_key",
      provider,
      key: envValue,
    });
    await configService.patchEnv({ [envKey]: null });
    configLog.info("[credential.migrate]", `provider=${provider} envKey=${envKey} → auth-profiles`);
  }

  // Channel tokens: env → config paths
  for (const { envKey, configPath } of LEGACY_CHANNEL_ENV_MAP) {
    const envValue = config.env[envKey];
    if (!envValue) continue;

    const existing = getNestedValue(config, configPath);
    if (existing) continue;

    await configService.patchPath(configPath, envValue);
    await configService.patchEnv({ [envKey]: null });
    configLog.info("[credential.migrate]", `envKey=${envKey} → ${configPath}`);
  }
}
