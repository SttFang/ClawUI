import { Button } from "@clawui/ui";
import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentCapabilities } from "@/routes/agents/components/AgentCapabilities";
import { AgentExtensions } from "@/routes/agents/components/AgentExtensions";
import { AgentIdentity } from "@/routes/agents/components/AgentIdentity";
import { AgentInputs } from "@/routes/agents/components/AgentInputs";
import { AgentList } from "@/routes/agents/components/AgentList";
import { AgentSkills } from "@/routes/agents/components/AgentSkills";
import { CronDialog } from "@/routes/agents/components/CronDialog";
import { CronPanel } from "@/routes/agents/components/CronPanel";
import { CronRunsDialog } from "@/routes/agents/components/CronRunsDialog";
import { buildAgentsExportPayload } from "@/routes/agents/export";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useMCPStore, selectServers as selectMcpServers } from "@/store/mcp";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";
import { useToolsStore, selectToolsConfig, selectTools } from "@/store/tools";

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

export function AgentsFeature() {
  const { t } = useTranslation("common");

  const configError = useAgentsStore(agentsSelectors.selectConfigError);
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);
  const config = useAgentsStore(agentsSelectors.selectConfig);
  const skills = useAgentsStore(agentsSelectors.selectSkills);
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const cronJobs = useAgentsStore(agentsSelectors.selectCronJobs);
  const loadConfig = useAgentsStore((s) => s.loadConfig);
  const loadSkills = useAgentsStore((s) => s.loadSkills);
  const loadCronStatus = useAgentsStore((s) => s.loadCronStatus);
  const loadCronJobs = useAgentsStore((s) => s.loadCronJobs);
  const clearCronError = useAgentsStore((s) => s.clearCronError);

  const channels = useChannelsStore(selectChannels);
  const loadChannels = useChannelsStore((s) => s.loadChannels);
  const tools = useToolsStore(selectTools);
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
  }, [
    loadConfig,
    loadSkills,
    loadCronStatus,
    loadChannels,
    loadTools,
    loadPlugins,
    loadMcpServers,
  ]);

  const handleOpenCronDialog = useCallback(async () => {
    setCronDialogOpen(true);
    clearCronError();
    await Promise.all([loadCronStatus(), loadCronJobs()]);
  }, [clearCronError, loadCronStatus, loadCronJobs]);

  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledChannels = channels.filter((c) => c.isEnabled);

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
          enabledTools: tools.filter((x) => x.enabled).map((x) => x.name),
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
      tools,
      toolsConfig.accessMode,
      toolsConfig.sandboxEnabled,
    ],
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{t("agents.title")}</h1>
            <p className="text-muted-foreground">{t("agents.description")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadJson(`clawui-agents-${Date.now()}.json`, exportPayload)}
            className="shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            {t("agents.actions.exportJson")}
          </Button>
        </div>

        {configError && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <div className="font-medium text-destructive">{t("agents.errorTitle")}</div>
            <div className="text-sm text-destructive/90">{configError}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <AgentList />

          <div className="space-y-4">
            <AgentIdentity />
            <AgentInputs />
            <AgentCapabilities />
            <AgentExtensions />
            <AgentSkills />
            <CronPanel onOpenDialog={handleOpenCronDialog} />
          </div>
        </div>
      </div>

      <CronDialog open={cronDialogOpen} onOpenChange={setCronDialogOpen} />
      <CronRunsDialog />
    </div>
  );
}
