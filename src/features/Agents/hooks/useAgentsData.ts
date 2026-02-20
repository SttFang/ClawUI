import { useCallback, useEffect, useState } from "react";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useMCPStore, selectServers as selectMcpServers } from "@/store/mcp";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";
import { useToolsStore, selectToolsConfig } from "@/store/tools";

export function useAgentsData() {
  const configError = useAgentsStore(agentsSelectors.selectConfigError);
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);
  const config = useAgentsStore(agentsSelectors.selectConfig);
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const cronJobs = useAgentsStore(agentsSelectors.selectCronJobs);
  const loadConfig = useAgentsStore((s) => s.loadConfig);
  const loadSkills = useAgentsStore((s) => s.loadSkills);
  const loadCronStatus = useAgentsStore((s) => s.loadCronStatus);
  const loadCronJobs = useAgentsStore((s) => s.loadCronJobs);
  const clearCronError = useAgentsStore((s) => s.clearCronError);

  const channels = useChannelsStore(selectChannels);
  const loadChannels = useChannelsStore((s) => s.loadChannels);
  const toolsConfig = useToolsStore(selectToolsConfig);
  const loadTools = useToolsStore((s) => s.loadTools);
  const installedPlugins = usePluginsStore(selectInstalledPlugins);
  const loadPlugins = usePluginsStore((s) => s.loadPlugins);
  const mcpServers = useMCPStore(selectMcpServers);
  const loadMcpServers = useMCPStore((s) => s.loadServers);

  const [cronDialogOpen, setCronDialogOpen] = useState(false);

  useEffect(() => {
    void loadConfig();
    void loadSkills();
    void loadCronStatus();
    void loadChannels();
    void loadTools();
    void loadPlugins();
    void loadMcpServers();
  }, [loadConfig, loadSkills, loadCronStatus, loadChannels, loadTools, loadPlugins, loadMcpServers]);

  const handleOpenCronDialog = useCallback(async () => {
    setCronDialogOpen(true);
    clearCronError();
    await Promise.all([loadCronStatus(), loadCronJobs()]);
  }, [clearCronError, loadCronStatus, loadCronJobs]);

  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledChannels = channels.filter((c) => c.isEnabled);

  return {
    configError,
    selectedAgent,
    config,
    cronStatus,
    cronJobs,
    channels,
    toolsConfig,
    installedPlugins,
    mcpServers,
    configuredChannels,
    enabledChannels,
    cronDialogOpen,
    setCronDialogOpen,
    handleOpenCronDialog,
  };
}
