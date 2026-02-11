import { Button } from "@clawui/ui";
import { ExternalLink, Puzzle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  selectCategoryFilter,
  selectFilteredPlugins,
  selectIsLoading,
  selectSearchQuery,
  type Plugin,
  usePluginsStore,
} from "@/store/plugins";
import type { PluginCategoryFilter } from "./pluginConstants";
import { PluginConfigDialog } from "./PluginConfigDialog";
import { PluginFilters } from "./PluginFilters";
import { PluginGrid } from "./PluginGrid";

export function PluginsSection() {
  const { t } = useTranslation("common");
  const plugins = usePluginsStore(selectFilteredPlugins);
  const isLoading = usePluginsStore(selectIsLoading);
  const searchQuery = usePluginsStore(selectSearchQuery);
  const categoryFilter = usePluginsStore(selectCategoryFilter);

  const loadPlugins = usePluginsStore((s) => s.loadPlugins);
  const installPlugin = usePluginsStore((s) => s.installPlugin);
  const uninstallPlugin = usePluginsStore((s) => s.uninstallPlugin);
  const enablePlugin = usePluginsStore((s) => s.enablePlugin);
  const disablePlugin = usePluginsStore((s) => s.disablePlugin);
  const updatePluginConfig = usePluginsStore((s) => s.updatePluginConfig);
  const setSearchQuery = usePluginsStore((s) => s.setSearchQuery);
  const setCategoryFilter = usePluginsStore((s) => s.setCategoryFilter);

  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const handleToggleEnabled = (plugin: Plugin) => {
    if (plugin.enabled) {
      void disablePlugin(plugin.id);
    } else {
      void enablePlugin(plugin.id);
    }
  };

  const handleOpenConfig = (plugin: Plugin) => {
    setConfigPlugin(plugin);
    setConfigDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">{t("plugins.title")}</h2>
          <p className="text-muted-foreground">{t("plugins.description")}</p>
        </div>
        <Button variant="outline">
          <ExternalLink className="w-4 h-4 mr-2" />
          {t("plugins.browseClawHub")}
        </Button>
      </div>

      <PluginFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        categoryFilter={categoryFilter as PluginCategoryFilter}
        onCategoryFilterChange={setCategoryFilter}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : plugins.length === 0 ? (
        <div className="text-center py-12">
          <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("plugins.emptyTitle")}</h3>
          <p className="text-muted-foreground">{t("plugins.emptyDescription")}</p>
        </div>
      ) : (
        <PluginGrid
          plugins={plugins}
          onToggleEnabled={handleToggleEnabled}
          onInstall={(id) => void installPlugin(id)}
          onUninstall={(id) => void uninstallPlugin(id)}
          onOpenConfig={handleOpenConfig}
        />
      )}

      <PluginConfigDialog
        plugin={configPlugin}
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={(id, config) => void updatePluginConfig(id, config)}
      />
    </>
  );
}
