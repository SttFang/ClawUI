import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";
import type { Plugin, PluginCategory, PluginsPersistState, PluginsState } from "./types";
import {
  createInstallRecord,
  deriveInstalled,
  readBoolean,
  parsePluginCatalogFromSchema,
  readPluginsConfigState,
} from "./helpers";

interface PluginsPublicActions {
  loadPlugins: () => Promise<void>;
  installPlugin: (id: string) => Promise<void>;
  uninstallPlugin: (id: string) => Promise<void>;
  enablePlugin: (id: string) => Promise<void>;
  disablePlugin: (id: string) => Promise<void>;
  updatePluginConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: PluginCategory | "all") => void;
}

interface PluginsInternalActions {
  internal_dispatchPlugins: (updater: (plugins: Plugin[]) => Plugin[], action: string) => void;
  internal_persistMutation: (
    mutate: (state: PluginsPersistState) => void,
    action: string,
  ) => Promise<void>;
}

type PluginsStore = PluginsState & PluginsPublicActions & PluginsInternalActions;

const initialState: PluginsState = {
  plugins: [],
  isLoading: false,
  error: null,
  searchQuery: "",
  categoryFilter: "all",
};

export const usePluginsStore = create<PluginsStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      internal_dispatchPlugins: (updater, action) => {
        set(
          (state) => ({
            plugins: updater(state.plugins),
          }),
          false,
          action,
        );
      },

      internal_persistMutation: async (mutate, action) => {
        const draftStore = useConfigDraftStore.getState();
        await draftStore.loadSnapshot();
        const current = readPluginsConfigState(draftStore.snapshot?.config ?? {});
        mutate(current);
        await draftStore.applyPatch({
          plugins: {
            entries: current.entries,
            installs: current.installs,
          },
        });
        set({ error: null }, false, `${action}/persisted`);
      },

      loadPlugins: async () => {
        set({ isLoading: true, error: null }, false, "loadPlugins");
        try {
          const [snapshot, schema] = await Promise.all([
            ipc.config.getSnapshot(),
            ipc.config.getSchema(),
          ]);
          const catalogPlugins = parsePluginCatalogFromSchema(schema);
          const { entries, installs } = readPluginsConfigState(snapshot.config);
          get().internal_dispatchPlugins(() => {
            return catalogPlugins.map((plugin) => {
              const entry = entries[plugin.id];
              const installRecord = installs[plugin.id];
              const hasInstallRecord = Boolean(installRecord);
              return {
                ...plugin,
                enabled: readBoolean(entry?.enabled) ?? false,
                installed: deriveInstalled({
                  baseInstalled: false,
                  entry,
                  hasInstallRecord,
                }),
                version:
                  typeof installRecord?.version === "string" && installRecord.version.trim()
                    ? installRecord.version
                    : plugin.version,
                author:
                  typeof installRecord?.source === "string" && installRecord.source.trim()
                    ? installRecord.source
                    : plugin.author,
                config: entry?.config ?? plugin.config,
              };
            });
          }, "loadPlugins/dispatch");
          set({ isLoading: false }, false, "loadPlugins/success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load plugins";
          set({ error: message, isLoading: false }, false, "loadPlugins/error");
        }
      },

      installPlugin: async (id) => {
        const plugins = get().plugins;
        const plugin = plugins.find((item) => item.id === id);
        if (!plugin || plugin.installed) return;

        set({ isLoading: true, error: null }, false, "installPlugin");
        try {
          await get().internal_persistMutation(({ entries, installs }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: true,
              config: plugin.config ?? existing.config,
            };
            installs[id] = installs[id] ?? createInstallRecord(plugin);
          }, "installPlugin");

          get().internal_dispatchPlugins(
            (current) =>
              current.map((item) =>
                item.id === id ? { ...item, installed: true, enabled: true } : item,
              ),
            "installPlugin/dispatch",
          );
          set({ isLoading: false }, false, "installPlugin/success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to install plugin";
          set({ error: message, isLoading: false }, false, "installPlugin/error");
        }
      },

      uninstallPlugin: async (id) => {
        const plugins = get().plugins;
        const plugin = plugins.find((item) => item.id === id);
        if (!plugin || !plugin.installed) return;

        set({ isLoading: true, error: null }, false, "uninstallPlugin");
        try {
          await get().internal_persistMutation(({ entries, installs }) => {
            entries[id] = { enabled: false };
            delete installs[id];
          }, "uninstallPlugin");

          get().internal_dispatchPlugins(
            (current) =>
              current.map((item) =>
                item.id === id
                  ? { ...item, installed: false, enabled: false, config: undefined }
                  : item,
              ),
            "uninstallPlugin/dispatch",
          );
          set({ isLoading: false }, false, "uninstallPlugin/success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to uninstall plugin";
          set({ error: message, isLoading: false }, false, "uninstallPlugin/error");
        }
      },

      enablePlugin: async (id) => {
        const prevPlugins = get().plugins;
        const plugin = prevPlugins.find((item) => item.id === id);
        if (!plugin) return;

        get().internal_dispatchPlugins(
          (current) => current.map((item) => (item.id === id ? { ...item, enabled: true } : item)),
          "enablePlugin/optimistic",
        );

        try {
          await get().internal_persistMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: true,
              config: plugin.config ?? existing.config,
            };
          }, "enablePlugin");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to enable plugin";
          set({ plugins: prevPlugins, error: message }, false, "enablePlugin/rollback");
        }
      },

      disablePlugin: async (id) => {
        const prevPlugins = get().plugins;
        const plugin = prevPlugins.find((item) => item.id === id);
        if (!plugin) return;

        get().internal_dispatchPlugins(
          (current) => current.map((item) => (item.id === id ? { ...item, enabled: false } : item)),
          "disablePlugin/optimistic",
        );

        try {
          await get().internal_persistMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: false,
              config: plugin.config ?? existing.config,
            };
          }, "disablePlugin");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to disable plugin";
          set({ plugins: prevPlugins, error: message }, false, "disablePlugin/rollback");
        }
      },

      updatePluginConfig: async (id, config) => {
        const prevPlugins = get().plugins;
        const plugin = prevPlugins.find((item) => item.id === id);
        if (!plugin) return;

        get().internal_dispatchPlugins(
          (current) => current.map((item) => (item.id === id ? { ...item, config } : item)),
          "updatePluginConfig/optimistic",
        );

        try {
          await get().internal_persistMutation(({ entries }) => {
            const existing = entries[id] ?? {};
            entries[id] = {
              ...existing,
              enabled: readBoolean(existing.enabled) ?? plugin.enabled,
              config,
            };
          }, "updatePluginConfig");
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

export type {
  Plugin,
  PluginCategory,
  PluginConfigField,
  PluginConfigSchema,
  PluginsEntriesMap,
  PluginsInstallsMap,
  PluginsPersistState,
  PluginsState,
} from "./types";

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
  state.plugins.filter((plugin) => plugin.installed),
);

export const selectEnabledPlugins = createWeakCachedSelector((state: PluginsStore) =>
  state.plugins.filter((plugin) => plugin.enabled),
);

export const selectPluginById = (id: string) => (state: PluginsStore) =>
  state.plugins.find((plugin) => plugin.id === id);

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
