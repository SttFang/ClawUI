import { useMemo } from "react";
import { buildAgentsExportPayload } from "@/routes/agents/export";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import type { useAgentsData } from "./useAgentsData";

function downloadJson(filename: string, data: unknown): void {
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useAgentsExport(data: ReturnType<typeof useAgentsData>) {
  const {
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
  } = data;

  const skills = useAgentsStore(agentsSelectors.selectSkills);

  const exportPayload = useMemo(
    () =>
      buildAgentsExportPayload({
        exportedAt: new Date().toISOString(),
        agent: selectedAgent,
        channels: {
          configured: configuredChannels.length,
          enabled: enabledChannels.length,
          items: channels.map((c) => ({
            type: c.type,
            name: c.name,
            configured: c.isConfigured,
            enabled: c.isEnabled,
          })),
        },
        tools: {
          accessMode: toolsConfig.accessMode,
          sandboxEnabled: toolsConfig.sandboxEnabled,
          allowList: toolsConfig.allowList,
          denyList: toolsConfig.denyList,
        },
        pluginsInstalled: installedPlugins.map((p) => ({
          id: p.id,
          name: p.name,
          version: p.version,
        })),
        mcpServers: mcpServers.map((s) => ({
          id: s.id,
          name: s.name,
          command: s.command,
          args: s.args,
          enabled: s.enabled,
        })),
        skills,
        cronStatus,
        cronJobs,
        config,
      }),
    [
      channels,
      configuredChannels.length,
      cronJobs,
      cronStatus,
      enabledChannels.length,
      config,
      installedPlugins,
      mcpServers,
      selectedAgent,
      skills,
      toolsConfig.accessMode,
      toolsConfig.allowList,
      toolsConfig.denyList,
      toolsConfig.sandboxEnabled,
    ],
  );

  const handleExport = () => {
    downloadJson(`clawui-agents-${Date.now()}.json`, exportPayload);
  };

  return { exportPayload, handleExport };
}
