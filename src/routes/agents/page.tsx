import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "@clawui/ui";
import { Bot, Boxes, Cable, CalendarClock, Download, Shield, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OpenClawConfig, SkillsListResult } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { useChannelsStore, selectChannels } from "@/store/channels";
import { useMCPStore, selectServers as selectMcpServers } from "@/store/mcp";
import { usePluginsStore, selectInstalledPlugins } from "@/store/plugins";
import { useToolsStore, selectToolsConfig, selectTools } from "@/store/tools";
import type { CronSchedule } from "./cronFormat";
import { formatCronSchedule, formatTimestamp } from "./cronFormat";
import { buildAgentsExportPayload } from "./export";

type AgentView = {
  id: string;
  modelPrimary: string | null;
  modelFallbacks: string[];
  workspace: string | null;
};

type CronStatus = {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
  storePath?: string;
};

type CronJob = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "now" | "next-heartbeat";
  payload: unknown;
  delivery?: unknown;
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: "ok" | "error" | "skipped";
    lastError?: string;
    lastDurationMs?: number;
  };
};

type CronRunsResult = {
  entries: Array<{
    ts: number;
    jobId: string;
    status: "ok" | "error" | "skipped";
    durationMs?: number;
    error?: string;
    summary?: string;
    sessionId?: string;
    sessionKey?: string;
  }>;
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

export default function AgentsPage() {
  const { t } = useTranslation("common");

  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("main");
  const [skills, setSkills] = useState<SkillsListResult | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[] | null>(null);
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronDialogOpen, setCronDialogOpen] = useState(false);
  const [cronBusyJobId, setCronBusyJobId] = useState<string | null>(null);
  const [cronRunsDialog, setCronRunsDialog] = useState<{
    jobId: string;
    entries: CronRunsResult["entries"];
  } | null>(null);

  const channels = useChannelsStore(selectChannels);
  const loadChannels = useChannelsStore((s) => s.loadChannels);

  const tools = useToolsStore(selectTools);
  const toolsConfig = useToolsStore(selectToolsConfig);
  const loadTools = useToolsStore((s) => s.loadTools);

  const installedPlugins = usePluginsStore(selectInstalledPlugins);
  const loadPlugins = usePluginsStore((s) => s.loadPlugins);

  const mcpServers = useMCPStore(selectMcpServers);
  const loadMcpServers = useMCPStore((s) => s.loadServers);

  async function ensureChatConnected(): Promise<boolean> {
    const connected = await ipc.chat.isConnected();
    if (connected) return true;
    return await ipc.chat.connect();
  }

  async function loadCronStatus(): Promise<void> {
    try {
      const ok = await ensureChatConnected();
      if (!ok) return;
      const payload = (await ipc.chat.request("cron.status", {})) as CronStatus;
      setCronStatus(payload ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCronError(message);
    }
  }

  async function loadCronJobs(): Promise<void> {
    try {
      const ok = await ensureChatConnected();
      if (!ok) return;
      const payload = (await ipc.chat.request("cron.list", { includeDisabled: true })) as {
        jobs?: CronJob[];
      };
      setCronJobs(Array.isArray(payload?.jobs) ? payload.jobs : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setCronError(message);
    }
  }

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

    (async () => {
      try {
        const res = await ipc.skills.list();
        if (!cancelled) setSkills(res);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setSkillsError(message);
      }
    })();

    void loadCronStatus();

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
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null;

  const configuredChannels = channels.filter((c) => c.isConfigured);
  const enabledChannels = channels.filter((c) => c.isEnabled);

  const skillsMain = skills?.profiles?.main ?? null;
  const skillsConfigAgent = skills?.profiles?.configAgent ?? null;

  const exportPayload = useMemo(() => {
    return buildAgentsExportPayload({
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
    });
  }, [
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
  ]);

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
                      <span className="text-xs text-muted-foreground">
                        {t("agents.list.defaultTag")}
                      </span>
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
                <div className="text-xs text-muted-foreground">{t("agents.tools.policyNote")}</div>
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
                <div className="text-xs text-muted-foreground">{t("agents.extensions.note")}</div>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle>{t("agents.sections.skills.title")}</CardTitle>
                <CardDescription>{t("agents.sections.skills.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {skillsError && (
                  <div className="text-sm text-destructive">
                    {t("agents.skills.loadFailed")}: {skillsError}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("agents.skills.profileMain")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono break-all">
                      {skillsMain?.dir ?? "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(skillsMain?.skills ?? []).slice(0, 24).map((s) => (
                        <span key={s} className="rounded-md border bg-muted px-2 py-1 text-xs">
                          {s}
                        </span>
                      ))}
                      {(skillsMain?.skills?.length ?? 0) === 0 && (
                        <span className="text-sm text-muted-foreground">
                          {t("agents.skills.none")}
                        </span>
                      )}
                    </div>
                    {(skillsMain?.skills?.length ?? 0) > 24 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t("agents.skills.more", { count: (skillsMain?.skills?.length ?? 0) - 24 })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("agents.skills.profileConfigAgent")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono break-all">
                      {skillsConfigAgent?.dir ?? "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(skillsConfigAgent?.skills ?? []).slice(0, 24).map((s) => (
                        <span key={s} className="rounded-md border bg-muted px-2 py-1 text-xs">
                          {s}
                        </span>
                      ))}
                      {(skillsConfigAgent?.skills?.length ?? 0) === 0 && (
                        <span className="text-sm text-muted-foreground">
                          {t("agents.skills.none")}
                        </span>
                      )}
                    </div>
                    {(skillsConfigAgent?.skills?.length ?? 0) > 24 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t("agents.skills.more", {
                          count: (skillsConfigAgent?.skills?.length ?? 0) - 24,
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{t("agents.skills.note")}</div>
              </CardContent>
            </Card>

            {/* Cron */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarClock className="w-5 h-5" />
                      {t("agents.sections.cron.title")}
                    </CardTitle>
                    <CardDescription>{t("agents.sections.cron.description")}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setCronDialogOpen(true);
                      setCronError(null);
                      await Promise.all([loadCronStatus(), loadCronJobs()]);
                    }}
                  >
                    {t("agents.cron.openPanel")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cronError && (
                  <div className="text-sm text-destructive">
                    {t("agents.cron.loadFailed")}: {cronError}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("agents.cron.enabled")}</div>
                    <div className="font-medium">
                      {cronStatus
                        ? cronStatus.enabled
                          ? t("agents.values.enabled")
                          : t("agents.values.disabled")
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{t("agents.cron.jobs")}</div>
                    <div className="font-medium">{cronStatus?.jobs ?? "—"}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("agents.cron.nextWake")}:{" "}
                  {cronStatus ? formatTimestamp(cronStatus.nextWakeAtMs ?? null) : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cron panel dialog */}
      <Dialog open={cronDialogOpen} onOpenChange={setCronDialogOpen}>
        <DialogContent className="max-w-3xl" onClose={() => setCronDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t("agents.cron.panelTitle")}</DialogTitle>
            <DialogDescription>{t("agents.cron.panelDescription")}</DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {t("agents.cron.statusLine", {
                  enabled: cronStatus?.enabled
                    ? t("agents.values.enabled")
                    : t("agents.values.disabled"),
                  jobs: cronStatus?.jobs ?? 0,
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setCronError(null);
                  await Promise.all([loadCronStatus(), loadCronJobs()]);
                }}
              >
                {t("agents.cron.refresh")}
              </Button>
            </div>

            <div className="space-y-2">
              {(cronJobs ?? []).map((job) => {
                const busy = cronBusyJobId === job.id;
                const nextRun = formatTimestamp(job.state?.nextRunAtMs);
                const lastRun = formatTimestamp(job.state?.lastRunAtMs);
                const lastStatus = job.state?.lastStatus ?? "—";

                return (
                  <div key={job.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{job.name}</div>
                        {job.description && (
                          <div className="text-sm text-muted-foreground">{job.description}</div>
                        )}
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <div>
                            <span className="font-mono">{job.id}</span>
                          </div>
                          <div>
                            {t("agents.cron.schedule")}:{" "}
                            <span className="font-mono">{formatCronSchedule(job.schedule)}</span>
                          </div>
                          <div>
                            {t("agents.cron.nextRun")}: <span className="font-mono">{nextRun}</span>
                          </div>
                          <div>
                            {t("agents.cron.lastRun")}: <span className="font-mono">{lastRun}</span>
                            <span className="ml-2">
                              {t("agents.cron.lastStatus")}: {lastStatus}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {t("agents.cron.enabled")}
                          </span>
                          <Switch
                            checked={job.enabled}
                            onCheckedChange={async (checked) => {
                              setCronBusyJobId(job.id);
                              try {
                                await ipc.chat.request("cron.update", {
                                  id: job.id,
                                  patch: { enabled: checked },
                                });
                                await Promise.all([loadCronStatus(), loadCronJobs()]);
                              } catch (e) {
                                const message = e instanceof Error ? e.message : String(e);
                                setCronError(message);
                              } finally {
                                setCronBusyJobId(null);
                              }
                            }}
                            disabled={busy}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              setCronBusyJobId(job.id);
                              try {
                                await ipc.chat.request("cron.run", { id: job.id, mode: "force" });
                                await Promise.all([loadCronStatus(), loadCronJobs()]);
                              } catch (e) {
                                const message = e instanceof Error ? e.message : String(e);
                                setCronError(message);
                              } finally {
                                setCronBusyJobId(null);
                              }
                            }}
                          >
                            {t("agents.cron.runNow")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              setCronBusyJobId(job.id);
                              try {
                                const payload = (await ipc.chat.request("cron.runs", {
                                  id: job.id,
                                  limit: 50,
                                })) as CronRunsResult;
                                setCronRunsDialog({
                                  jobId: job.id,
                                  entries: Array.isArray(payload?.entries) ? payload.entries : [],
                                });
                              } catch (e) {
                                const message = e instanceof Error ? e.message : String(e);
                                setCronError(message);
                              } finally {
                                setCronBusyJobId(null);
                              }
                            }}
                          >
                            {t("agents.cron.viewRuns")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              const ok = window.confirm(t("agents.cron.confirmRemove"));
                              if (!ok) return;
                              setCronBusyJobId(job.id);
                              try {
                                await ipc.chat.request("cron.remove", { id: job.id });
                                await Promise.all([loadCronStatus(), loadCronJobs()]);
                              } catch (e) {
                                const message = e instanceof Error ? e.message : String(e);
                                setCronError(message);
                              } finally {
                                setCronBusyJobId(null);
                              }
                            }}
                          >
                            {t("agents.cron.remove")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {(cronJobs?.length ?? 0) === 0 && (
                <div className="text-sm text-muted-foreground">{t("agents.cron.empty")}</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCronDialogOpen(false)}>
              {t("actions.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cronRunsDialog} onOpenChange={(open) => !open && setCronRunsDialog(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setCronRunsDialog(null)}>
          <DialogHeader>
            <DialogTitle>{t("agents.cron.runsTitle")}</DialogTitle>
            <DialogDescription className="font-mono">
              {cronRunsDialog?.jobId ?? ""}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4 space-y-2">
            {(cronRunsDialog?.entries ?? []).map((e) => (
              <div key={`${e.ts}-${e.jobId}`} className="rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono">{formatTimestamp(e.ts)}</div>
                  <div>{e.status}</div>
                </div>
                {e.summary && <div className="mt-1 text-muted-foreground">{e.summary}</div>}
                {e.error && <div className="mt-1 text-destructive">{e.error}</div>}
                {(e.sessionKey || e.sessionId) && (
                  <div className="mt-1 text-muted-foreground font-mono">
                    {e.sessionKey ?? e.sessionId}
                  </div>
                )}
              </div>
            ))}
            {(cronRunsDialog?.entries?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">{t("agents.cron.runsEmpty")}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCronRunsDialog(null)}>
              {t("actions.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
