import type { Plugin, PluginsEntriesMap, PluginsInstallsMap, PluginsPersistState } from "./types";

type JsonObject = Record<string, unknown>;

export function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toPluginsEntriesMap(value: unknown): PluginsEntriesMap {
  const source = asRecord(value);
  if (!source) return {};
  const next: PluginsEntriesMap = {};
  for (const [pluginId, entryValue] of Object.entries(source)) {
    const entry = asRecord(entryValue);
    if (!entry) continue;
    next[pluginId] = {
      enabled: readBoolean(entry.enabled),
      config: asRecord(entry.config) ?? undefined,
    };
  }
  return next;
}

function toPluginsInstallsMap(value: unknown): PluginsInstallsMap {
  const source = asRecord(value);
  if (!source) return {};
  const next: PluginsInstallsMap = {};
  for (const [pluginId, installValue] of Object.entries(source)) {
    const install = asRecord(installValue);
    if (!install) continue;
    next[pluginId] = install;
  }
  return next;
}

export function readPluginsConfigState(config: unknown): PluginsPersistState {
  const root = asRecord(config) ?? {};
  const plugins = asRecord(root.plugins) ?? {};
  return {
    entries: toPluginsEntriesMap(plugins.entries),
    installs: toPluginsInstallsMap(plugins.installs),
  };
}

export function deriveInstalled(params: {
  baseInstalled: boolean;
  entry: { enabled?: boolean; config?: Record<string, unknown> } | undefined;
  hasInstallRecord: boolean;
}): boolean {
  if (params.baseInstalled) return true;
  if (params.hasInstallRecord) return true;
  return params.entry?.enabled === true;
}

export function createInstallRecord(plugin: Plugin): JsonObject {
  return {
    source: "path",
    spec: `clawui:${plugin.id}`,
    version: plugin.version,
    installedAt: new Date().toISOString(),
  };
}
