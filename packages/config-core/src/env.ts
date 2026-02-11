import type { ConfigObject, ConfigPathPatch } from "./types";

type EnvObject = {
  shellEnv?: unknown;
  vars?: unknown;
  [key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeEnvKey(key: string): string {
  return key.trim();
}

export function readConfigEnvVars(config: ConfigObject | null | undefined): Record<string, string> {
  if (!config) return {};

  const env = config.env;
  if (!isObject(env)) return {};

  const envObject = env as EnvObject;
  const entries: Record<string, string> = {};

  if (isObject(envObject.vars)) {
    for (const [key, value] of Object.entries(envObject.vars)) {
      const envKey = normalizeEnvKey(key);
      const envValue = readString(value);
      if (!envKey || envValue === null) continue;
      entries[envKey] = envValue;
    }
  }

  for (const [key, value] of Object.entries(envObject)) {
    if (key === "shellEnv" || key === "vars") continue;
    const envKey = normalizeEnvKey(key);
    const envValue = readString(value);
    if (!envKey || envValue === null) continue;
    entries[envKey] = envValue;
  }

  return entries;
}

export function createEnvPathPatches(
  patch: Record<string, string | null | undefined>,
): ConfigPathPatch[] {
  const operations: ConfigPathPatch[] = [];

  for (const [rawKey, rawValue] of Object.entries(patch)) {
    const key = normalizeEnvKey(rawKey);
    if (!key) continue;

    const value = rawValue === null || rawValue === undefined ? undefined : String(rawValue);

    operations.push({ path: ["env", "vars", key], value });
    operations.push({ path: ["env", key], value });
  }

  return operations;
}
