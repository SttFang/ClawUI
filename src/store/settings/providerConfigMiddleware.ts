import type { ModelsStatus, ProviderAuthInfo } from "@clawui/types/models";
import {
  getKnownProviderIds,
  getProviderEnvKeys,
  normalizeProviderId,
  resolveProviderEnvKey,
} from "./providerRegistry";

function findProviderAuthInfo(
  modelsStatus: ModelsStatus | null,
  providerId: string,
): ProviderAuthInfo | null {
  if (!modelsStatus) return null;
  const normalized = normalizeProviderId(providerId);
  const providers = modelsStatus.auth.providers ?? [];
  return (
    providers.find((provider) => normalizeProviderId(provider.provider) === normalized) ?? null
  );
}

export function readApiKeysFromEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};

  // Hydrate known providers by explicit env mappings.
  for (const providerId of getKnownProviderIds()) {
    const envKeys = getProviderEnvKeys(providerId);
    const first = envKeys
      .map((envKey) => env[envKey]?.trim())
      .find((value): value is string => Boolean(value));
    if (first) {
      result[providerId] = first;
    }
  }

  return result;
}

export function canSaveApiKeyForProvider(params: {
  providerId: string;
  modelsStatus: ModelsStatus | null;
}): boolean {
  const authInfo = findProviderAuthInfo(params.modelsStatus, params.providerId);
  return Boolean(resolveProviderEnvKey({ providerId: params.providerId, authInfo }));
}

export function hydrateApiKeysFromModelsStatus(params: {
  apiKeys: Record<string, string>;
  modelsStatus: ModelsStatus | null;
  env: Record<string, string | undefined>;
}): Record<string, string> {
  const { apiKeys, modelsStatus, env } = params;
  if (!modelsStatus) return apiKeys;

  const next = { ...apiKeys };
  for (const provider of modelsStatus.auth.providers ?? []) {
    const providerId = normalizeProviderId(provider.provider);
    if (!providerId) continue;
    const envKey = resolveProviderEnvKey({
      providerId,
      authInfo: provider,
    });
    if (!envKey) continue;
    const value = env[envKey]?.trim();
    if (value) {
      next[providerId] = value;
    }
  }
  return next;
}

export function buildProviderEnvPatch(params: {
  apiKeys: Record<string, string>;
  modelsStatus: ModelsStatus | null;
  providerId?: string;
}): Record<string, string | null> {
  const { apiKeys, modelsStatus, providerId } = params;
  const patch: Record<string, string | null> = {};

  const providersToPersist = providerId
    ? [normalizeProviderId(providerId)]
    : Object.keys(apiKeys).map((id) => normalizeProviderId(id));

  for (const normalized of providersToPersist) {
    if (!normalized) continue;
    const authInfo = findProviderAuthInfo(modelsStatus, normalized);
    const envKey = resolveProviderEnvKey({ providerId: normalized, authInfo });
    const value = apiKeys[normalized]?.trim();

    if (!envKey) {
      if (providerId) {
        throw new Error(`Provider "${providerId}" does not support API key persistence.`);
      }
      continue;
    }

    if (!value) continue;
    patch[envKey] = value;
  }

  return patch;
}
