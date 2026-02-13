import type { ConfigSchemaV2, ConfigUiHintV2 } from "@clawui/types/config-v2";
import type {
  Plugin,
  PluginCategory,
  PluginConfigField,
  PluginConfigSchema,
  PluginsEntriesMap,
  PluginsInstallsMap,
  PluginsPersistState,
} from "./types";

type JsonObject = Record<string, unknown>;

export function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toTitleCase(raw: string): string {
  return raw
    .split(/[-_.]/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function toPluginCategory(pluginId: string): PluginCategory {
  const id = pluginId.toLowerCase();
  if (/(github|slack|discord|telegram|notion|jira|gitlab|google)/.test(id)) return "integration";
  if (/(search|web|image|llm|memory|code|agent|vision|audio)/.test(id)) return "ai";
  if (/(export|timer|calendar|pomodoro|todo|task|note)/.test(id)) return "productivity";
  return "utility";
}

function looksLikeConfigPath(path: string, pluginId: string): string | null {
  const prefix = `plugins.entries.${pluginId}.config.`;
  if (!path.startsWith(prefix)) return null;
  const fieldPath = path.slice(prefix.length).trim();
  if (!fieldPath || fieldPath.includes(".")) return null;
  return fieldPath;
}

function asOptions(value: unknown): Array<{ label: string; value: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .filter(
      (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
    )
    .map((entry) => String(entry))
    .map((entry) => ({ label: entry, value: entry }));
  return options.length > 0 ? options : undefined;
}

function parseFieldType(schema: JsonObject): PluginConfigField["type"] {
  const schemaType = readString(schema.type);
  if (schemaType === "number" || schemaType === "integer") return "number";
  if (schemaType === "boolean") return "boolean";
  const options = asOptions(schema.enum);
  if (options && options.length > 0) return "select";
  return "string";
}

function parsePluginConfigSchema(params: {
  pluginId: string;
  schema: unknown;
  uiHints: Record<string, ConfigUiHintV2>;
}): PluginConfigSchema | undefined {
  const pluginSchema = asRecord(params.schema);
  const props = asRecord(pluginSchema?.properties);
  const configNode = asRecord(props?.config);
  const configProps = asRecord(configNode?.properties);
  const requiredList = Array.isArray(configNode?.required)
    ? configNode.required.filter((entry): entry is string => typeof entry === "string")
    : [];
  const requiredSet = new Set(requiredList);

  const parsed: PluginConfigSchema = {};

  if (configProps) {
    for (const [fieldKey, fieldSchemaValue] of Object.entries(configProps)) {
      const fieldSchema = asRecord(fieldSchemaValue) ?? {};
      const hint = params.uiHints[`plugins.entries.${params.pluginId}.config.${fieldKey}`];
      const options = asOptions(fieldSchema.enum);
      const fieldType = parseFieldType(fieldSchema);
      parsed[fieldKey] = {
        type: fieldType,
        label: hint?.label?.trim() || toTitleCase(fieldKey),
        description: hint?.help?.trim() || readString(fieldSchema.description),
        default: fieldSchema.default,
        options: fieldType === "select" ? options : undefined,
        required: requiredSet.has(fieldKey),
      };
    }
  }

  // Some plugins may only provide ui hints without JSON schema properties.
  for (const [path, hint] of Object.entries(params.uiHints)) {
    const fieldKey = looksLikeConfigPath(path, params.pluginId);
    if (!fieldKey || parsed[fieldKey]) continue;
    parsed[fieldKey] = {
      type: "string",
      label: hint.label?.trim() || toTitleCase(fieldKey),
      description: hint.help?.trim(),
      required: false,
    };
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

export function parsePluginCatalogFromSchema(schema: ConfigSchemaV2): Plugin[] {
  const rootSchema = asRecord(schema.schema);
  const rootProps = asRecord(rootSchema?.properties);
  const pluginsSchema = asRecord(rootProps?.plugins);
  const pluginsProps = asRecord(pluginsSchema?.properties);
  const entriesSchema = asRecord(pluginsProps?.entries);
  const entryProps = asRecord(entriesSchema?.properties);
  if (!entryProps) return [];

  return Object.entries(entryProps)
    .map(([pluginId, pluginSchema]) => {
      const entryHint = schema.uiHints[`plugins.entries.${pluginId}`];
      const name = entryHint?.label?.trim() || pluginId;
      const description = entryHint?.help?.trim() || `Plugin entry for ${pluginId}.`;
      const configSchema = parsePluginConfigSchema({
        pluginId,
        schema: pluginSchema,
        uiHints: schema.uiHints,
      });
      return {
        id: pluginId,
        name,
        description,
        version: "unknown",
        author: "OpenClaw",
        enabled: false,
        installed: false,
        category: toPluginCategory(pluginId),
        configSchema,
      } satisfies Plugin;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
