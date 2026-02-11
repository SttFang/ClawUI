export type PluginCategory = "ai" | "productivity" | "integration" | "utility";

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  installed: boolean;
  category: PluginCategory;
  icon?: string;
  configSchema?: PluginConfigSchema;
  config?: Record<string, unknown>;
}

export interface PluginConfigField {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description?: string;
  default?: unknown;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface PluginConfigSchema {
  [key: string]: PluginConfigField;
}

export interface PluginsState {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  categoryFilter: PluginCategory | "all";
}

export type PluginsEntriesMap = Record<
  string,
  {
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
>;

export type PluginsInstallsMap = Record<string, Record<string, unknown>>;

export interface PluginsPersistState {
  entries: PluginsEntriesMap;
  installs: PluginsInstallsMap;
}
