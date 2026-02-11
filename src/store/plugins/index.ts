import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";

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

interface PluginsState {
  plugins: Plugin[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  categoryFilter: PluginCategory | "all";
}

interface PluginsActions {
  loadPlugins: () => Promise<void>;
  installPlugin: (id: string) => Promise<void>;
  uninstallPlugin: (id: string) => Promise<void>;
  enablePlugin: (id: string) => Promise<void>;
  disablePlugin: (id: string) => Promise<void>;
  updatePluginConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: PluginCategory | "all") => void;
}

type PluginsStore = PluginsState & PluginsActions;

type JsonObject = Record<string, unknown>;
type PluginsEntriesMap = Record<string, { enabled?: boolean; config?: Record<string, unknown> }>;
type PluginsInstallsMap = Record<string, JsonObject>;

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function readBoolean(value: unknown): boolean | undefined {
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

function readPluginsConfigState(config: unknown): {
  entries: PluginsEntriesMap;
  installs: PluginsInstallsMap;
} {
  const root = asRecord(config) ?? {};
  const plugins = asRecord(root.plugins) ?? {};
  return {
    entries: toPluginsEntriesMap(plugins.entries),
    installs: toPluginsInstallsMap(plugins.installs),
  };
}

function deriveInstalled(params: {
  baseInstalled: boolean;
  entry: { enabled?: boolean; config?: Record<string, unknown> } | undefined;
  hasInstallRecord: boolean;
}): boolean {
  if (params.baseInstalled) return true;
  if (params.hasInstallRecord) return true;
  return params.entry?.enabled === true;
}

async function persistPluginsMutation(
  mutate: (state: { entries: PluginsEntriesMap; installs: PluginsInstallsMap }) => void,
): Promise<void> {
  const draftStore = useConfigDraftStore.getState();
  await draftStore.loadSnapshot();
  const snapshotConfig = draftStore.snapshot?.config ?? {};
  const current = readPluginsConfigState(snapshotConfig);
  mutate(current);
  await draftStore.applyPatch({
    plugins: {
      entries: current.entries,
      installs: current.installs,
    },
  });
}

function createInstallRecord(plugin: Plugin): JsonObject {
  return {
    source: "path",
    spec: `clawui:${plugin.id}`,
    version: plugin.version,
    installedAt: new Date().toISOString(),
  };
}

const defaultPlugins: Plugin[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Enable AI to search the web for real-time information",
    version: "1.0.0",
    author: "OpenClaw",
    enabled: true,
    installed: true,
    category: "ai",
    configSchema: {
      searchEngine: {
        type: "select",
        label: "Search Engine",
        description: "Default search engine to use",
        default: "google",
        options: [
          { label: "Google", value: "google" },
          { label: "Bing", value: "bing" },
          { label: "DuckDuckGo", value: "duckduckgo" },
        ],
      },
      maxResults: {
        type: "number",
        label: "Max Results",
        description: "Maximum number of search results to return",
        default: 10,
      },
    },
    config: {
      searchEngine: "google",
      maxResults: 10,
    },
  },
  {
    id: "code-interpreter",
    name: "Code Interpreter",
    description: "Execute Python code in a sandboxed environment",
    version: "1.2.0",
    author: "OpenClaw",
    enabled: false,
    installed: true,
    category: "ai",
    configSchema: {
      timeout: {
        type: "number",
        label: "Execution Timeout",
        description: "Maximum execution time in seconds",
        default: 30,
      },
      allowNetworkAccess: {
        type: "boolean",
        label: "Allow Network Access",
        description: "Allow code to make network requests",
        default: false,
      },
    },
    config: {
      timeout: 30,
      allowNetworkAccess: false,
    },
  },
  {
    id: "notion-sync",
    name: "Notion Sync",
    description: "Sync conversations and notes with Notion",
    version: "0.9.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "integration",
    configSchema: {
      apiKey: {
        type: "string",
        label: "Notion API Key",
        description: "Your Notion integration API key",
        required: true,
      },
      databaseId: {
        type: "string",
        label: "Database ID",
        description: "Notion database ID for syncing",
      },
    },
  },
  {
    id: "image-generation",
    name: "Image Generation",
    description: "Generate images using DALL-E, Stable Diffusion, and more",
    version: "2.0.0",
    author: "OpenClaw",
    enabled: false,
    installed: false,
    category: "ai",
    configSchema: {
      provider: {
        type: "select",
        label: "Default Provider",
        default: "dalle",
        options: [
          { label: "DALL-E 3", value: "dalle" },
          { label: "Stable Diffusion", value: "sd" },
          { label: "Midjourney", value: "mj" },
        ],
      },
    },
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description: "Connect to GitHub repositories, create issues, and manage PRs",
    version: "1.5.0",
    author: "OpenClaw",
    enabled: false,
    installed: false,
    category: "integration",
    configSchema: {
      token: {
        type: "string",
        label: "GitHub Token",
        description: "Personal access token with repo permissions",
        required: true,
      },
    },
  },
  {
    id: "markdown-export",
    name: "Markdown Export",
    description: "Export conversations to Markdown files",
    version: "1.0.0",
    author: "Community",
    enabled: true,
    installed: true,
    category: "productivity",
    configSchema: {
      includeMetadata: {
        type: "boolean",
        label: "Include Metadata",
        description: "Include timestamps and model info in exports",
        default: true,
      },
    },
    config: {
      includeMetadata: true,
    },
  },
  {
    id: "voice-input",
    name: "Voice Input",
    description: "Use voice commands and speech-to-text input",
    version: "0.8.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "utility",
    configSchema: {
      language: {
        type: "select",
        label: "Language",
        default: "en-US",
        options: [
          { label: "English (US)", value: "en-US" },
          { label: "English (UK)", value: "en-GB" },
          { label: "Spanish", value: "es-ES" },
          { label: "Chinese (Simplified)", value: "zh-CN" },
        ],
      },
    },
  },
  {
    id: "pomodoro-timer",
    name: "Pomodoro Timer",
    description: "Built-in productivity timer with focus sessions",
    version: "1.1.0",
    author: "Community",
    enabled: false,
    installed: false,
    category: "productivity",
    configSchema: {
      workDuration: {
        type: "number",
        label: "Work Duration (minutes)",
        default: 25,
      },
      breakDuration: {
        type: "number",
        label: "Break Duration (minutes)",
        default: 5,
      },
    },
  },
];

const initialState: PluginsState = {
  plugins: defaultPlugins,
  isLoading: false,
  error: null,
  searchQuery: "",
  categoryFilter: "all",
};

export const usePluginsStore = create<PluginsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadPlugins: async () => {
        set({ isLoading: true, error: null }, false, "loadPlugins");
        try {
          const snapshot = await ipc.config.getSnapshot();
          const { entries, installs } = readPluginsConfigState(snapshot.config);
          set(
            (state) => ({
              plugins: state.plugins.map((plugin) => {
                const entry = entries[plugin.id];
                const hasInstallRecord = Boolean(installs[plugin.id]);
                return {
                  ...plugin,
                  enabled: readBoolean(entry?.enabled) ?? plugin.enabled,
                  installed: deriveInstalled({
                    baseInstalled: plugin.installed,
                    entry,
                    hasInstallRecord,
                  }),
                  config: entry?.config ?? plugin.config,
                };
              }),
              isLoading: false,
            }),
            false,
            "loadPlugins/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load plugins";
          set({ error: message, isLoading: false }, false, "loadPlugins/error");
        }
      },

      installPlugin: async (id) => {
        const { plugins } = get();
        const plugin = plugins.find((p) => p.id === id);
        if (!plugin || plugin.installed) return;

        set({ isLoading: true }, false, "installPlugin");
        try {
          await persistPluginsMutation(({ entries, installs }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: true,
              config: plugin.config ?? existing.config,
            };
            installs[id] = installs[id] ?? createInstallRecord(plugin);
          });
          set(
            {
              plugins: plugins.map((p) =>
                p.id === id ? { ...p, installed: true, enabled: true } : p,
              ),
              isLoading: false,
            },
            false,
            "installPlugin/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to install plugin";
          set({ error: message, isLoading: false }, false, "installPlugin/error");
        }
      },

      uninstallPlugin: async (id) => {
        const { plugins } = get();
        const plugin = plugins.find((p) => p.id === id);
        if (!plugin || !plugin.installed) return;

        set({ isLoading: true }, false, "uninstallPlugin");
        try {
          await persistPluginsMutation(({ entries, installs }) => {
            entries[id] = { enabled: false };
            delete installs[id];
          });
          set(
            {
              plugins: plugins.map((p) =>
                p.id === id ? { ...p, installed: false, enabled: false, config: undefined } : p,
              ),
              isLoading: false,
            },
            false,
            "uninstallPlugin/success",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to uninstall plugin";
          set({ error: message, isLoading: false }, false, "uninstallPlugin/error");
        }
      },

      enablePlugin: async (id) => {
        const { plugins } = get();
        const plugin = plugins.find((p) => p.id === id);
        if (!plugin) return;
        const prevPlugins = plugins;
        const nextPlugins = plugins.map((p) => (p.id === id ? { ...p, enabled: true } : p));
        set({ plugins: nextPlugins }, false, "enablePlugin/optimistic");
        try {
          await persistPluginsMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: true,
              config: plugin.config ?? existing.config,
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to enable plugin";
          set({ plugins: prevPlugins, error: message }, false, "enablePlugin/rollback");
        }
      },

      disablePlugin: async (id) => {
        const { plugins } = get();
        const plugin = plugins.find((p) => p.id === id);
        if (!plugin) return;
        const prevPlugins = plugins;
        const nextPlugins = plugins.map((p) => (p.id === id ? { ...p, enabled: false } : p));
        set({ plugins: nextPlugins }, false, "disablePlugin/optimistic");
        try {
          await persistPluginsMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: false,
              config: plugin.config ?? existing.config,
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to disable plugin";
          set({ plugins: prevPlugins, error: message }, false, "disablePlugin/rollback");
        }
      },

      updatePluginConfig: async (id, config) => {
        const { plugins } = get();
        const plugin = plugins.find((p) => p.id === id);
        if (!plugin) return;
        const prevPlugins = plugins;
        const nextPlugins = plugins.map((p) => (p.id === id ? { ...p, config } : p));
        set({ plugins: nextPlugins }, false, "updatePluginConfig/optimistic");
        try {
          await persistPluginsMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: readBoolean(existing.enabled) ?? plugin.enabled,
              config,
            };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save plugin config";
          set({ plugins: prevPlugins, error: message }, false, "updatePluginConfig/rollback");
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query }, false, "setSearchQuery");
      },

      setCategoryFilter: (category) => {
        set({ categoryFilter: category }, false, "setCategoryFilter");
      },
    }),
    { name: "PluginsStore" },
  ),
);

// Selectors
export const selectPlugins = (state: PluginsStore) => state.plugins;
export const selectIsLoading = (state: PluginsStore) => state.isLoading;
export const selectError = (state: PluginsStore) => state.error;
export const selectSearchQuery = (state: PluginsStore) => state.searchQuery;
export const selectCategoryFilter = (state: PluginsStore) => state.categoryFilter;

// React 19 + useSyncExternalStore requires selectors returning arrays/objects to be stable
// for the same snapshot object, otherwise it can trigger unnecessary updates or loops.
export const selectFilteredPlugins = createWeakCachedSelector((state: PluginsStore) => {
  const { plugins, searchQuery, categoryFilter } = state;
  const query = searchQuery.trim().toLowerCase();

  return plugins.filter((plugin) => {
    const matchesSearch =
      !query ||
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query);
    const matchesCategory = categoryFilter === "all" || plugin.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
});

export const selectInstalledPlugins = createWeakCachedSelector((state: PluginsStore) =>
  state.plugins.filter((p) => p.installed),
);

export const selectEnabledPlugins = createWeakCachedSelector((state: PluginsStore) =>
  state.plugins.filter((p) => p.enabled),
);

export const selectPluginById = (id: string) => (state: PluginsStore) =>
  state.plugins.find((p) => p.id === id);

export const pluginsSelectors = {
  selectPlugins,
  selectIsLoading,
  selectError,
  selectSearchQuery,
  selectCategoryFilter,
  selectFilteredPlugins,
  selectInstalledPlugins,
  selectEnabledPlugins,
  selectPluginById,
};
