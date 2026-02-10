import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Bot, Boxes, Cable, Shield, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OpenClawConfig } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useMCPStore, selectServers as selectMcpServers } from "@/store/mcp";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";
import { useToolsStore, selectToolsConfig, selectTools } from "@/store/tools";

type AgentView = {
  id: string;
  modelPrimary: string | null;
  modelFallbacks: string[];
  workspace: string | null;
};

function toAgentViews(config: OpenClawConfig | null): AgentView[] {
  if (!config) return [];

  // Today ClawUI primarily manages a single "default agent" via agents.defaults.
  // If upstream OpenClaw adds agents.list later, we can extend this parsing without
  // changing the page structure.
  const defaults = config.agents?.defaults;
  return [
    {
      id: "main",
      modelPrimary: defaults?.model?.primary ?? null,
      modelFallbacks: defaults?.model?.fallbacks ?? [],
      workspace: defaults?.workspace ?? null,
    },
  ];
}

export default function AgentsPage() {
  const { t } = useTranslation("common");

  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("main");

  const channels = useChannelsStore(selectChannels);
  const loadChannels = useChannelsStore((s) => s.loadChannels);

  const tools = useToolsStore(selectTools);
  const toolsConfig = useToolsStore(selectToolsConfig);
  const loadTools = useToolsStore((s) => s.loadTools);

  const installedPlugins = usePluginsStore(selectInstalledPlugins);
  const loadPlugins = usePluginsStore((s) => s.loadPlugins);

  const mcpServers = useMCPStore(selectMcpServers);
  const loadMcpServers = useMCPStore((s) => s.loadServers);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = (await ipc.config.get()) ?? null;
        if (!cancelled) setConfig(cfg);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(message);
      }
    })();

    // Load related "attachments" in parallel.
    void loadChannels();
    void loadTools();
    void loadPlugins();
    void loadMcpServers();

    return () => {
      cancelled = true;
    };
  }, [loadChannels, loadTools, loadPlugins, loadMcpServers]);

  const agents = useMemo(() => toAgentViews(config), [config]);
  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null;

  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledChannels = channels.filter((c) => c.isEnabled);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t("agents.title")}</h1>
          <p className="text-muted-foreground">{t("agents.description")}</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <div className="font-medium text-destructive">{t("agents.errorTitle")}</div>
            <div className="text-sm text-destructive/90">{error}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          {/* Agent list */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <CardTitle>{t("agents.list.title")}</CardTitle>
              </div>
              <CardDescription>{t("agents.list.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("agents.list.empty")}</div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedAgentId === agent.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{agent.id}</div>
                      <span className="text-xs text-muted-foreground">default</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {agent.modelPrimary ?? t("agents.list.unknownModel")}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Agent details */}
          <div className="space-y-4">
            {/* Identity */}
            <Card>
              <CardHeader>
                <CardTitle>{t("agents.sections.identity.title")}</CardTitle>
                <CardDescription>{t("agents.sections.identity.description")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">{t("agents.fields.agentId")}</div>
                  <div className="font-mono">{selectedAgent?.id ?? "-"}</div>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">{t("agents.fields.modelPrimary")}</div>
                  <div className="font-mono">
                    {selectedAgent?.modelPrimary ?? t("agents.values.notConfigured")}
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">{t("agents.fields.modelFallbacks")}</div>
                  <div className="font-mono">
                    {selectedAgent?.modelFallbacks?.length
                      ? selectedAgent.modelFallbacks.join(", ")
                      : t("agents.values.none")}
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                  <div className="text-muted-foreground">{t("agents.fields.workspace")}</div>
                  <div className="font-mono">
                    {selectedAgent?.workspace ?? t("agents.values.notConfigured")}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Cable className="w-5 h-5" />
                      {t("agents.sections.inputs.title")}
                    </CardTitle>
                    <CardDescription>{t("agents.sections.inputs.description")}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="#/channels">{t("agents.actions.manageChannels")}</a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">{t("agents.inputs.channels")}: </span>
                  <span>
                    {t("agents.inputs.channelsStatus", {
                      configured: configuredChannels.length,
                      enabled: enabledChannels.length,
                    })}
                  </span>
                </div>
                <div className="grid gap-2">
                  {channels
                    .filter((c) => c.isConfigured)
                    .map((c) => (
                      <div key={c.type} className="flex items-center justify-between text-sm">
                        <div className="truncate">
                          {c.name}
                          <span className="ml-2 text-xs text-muted-foreground">{c.type}</span>
                        </div>
                        <div className={c.isEnabled ? "text-green-600" : "text-muted-foreground"}>
                          {c.isEnabled ? t("agents.values.enabled") : t("agents.values.disabled")}
                        </div>
                      </div>
                    ))}
                  {configuredChannels.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      {t("agents.inputs.noChannels")}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("agents.inputs.bindingsNote")}
                </div>
              </CardContent>
            </Card>

            {/* Capabilities */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      {t("agents.sections.capabilities.title")}
                    </CardTitle>
                    <CardDescription>
                      {t("agents.sections.capabilities.description")}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="#/tools">{t("agents.actions.manageTools")}</a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("agents.tools.access")}</div>
                    <div className="font-medium">{toolsConfig.accessMode}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("agents.tools.sandbox")}</div>
                    <div className="font-medium">
                      {toolsConfig.sandboxEnabled
                        ? t("agents.values.enabled")
                        : t("agents.values.disabled")}
                    </div>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t("agents.tools.enabledTools")}: </span>
                  <span>{tools.filter((x) => x.enabled).length}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("agents.tools.policyNote")}
                </div>
              </CardContent>
            </Card>

            {/* Extensions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Boxes className="w-5 h-5" />
                      {t("agents.sections.extensions.title")}
                    </CardTitle>
                    <CardDescription>{t("agents.sections.extensions.description")}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="#/plugins">{t("agents.actions.managePlugins")}</a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="#/mcp">{t("agents.actions.manageMcp")}</a>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Wrench className="w-3.5 h-3.5" />
                      {t("agents.extensions.plugins")}
                    </div>
                    <div className="font-medium">
                      {t("agents.extensions.pluginsStatus", {
                        installed: installedPlugins.length,
                      })}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Boxes className="w-3.5 h-3.5" />
                      {t("agents.extensions.mcp")}
                    </div>
                    <div className="font-medium">
                      {t("agents.extensions.mcpStatus", {
                        servers: mcpServers.length,
                      })}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("agents.extensions.note")}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
