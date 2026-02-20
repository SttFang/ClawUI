import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@clawui/ui";
import { Download, Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { AgentCapabilities } from "./components/AgentCapabilities";
import { AgentExtensions } from "./components/AgentExtensions";
import { AgentHero, type AttributeType } from "./components/AgentHero";
import { AgentSwitcher } from "./components/AgentSwitcher";
import { AttributeDialog } from "./components/AttributeDialog";
import { ChannelsPanel } from "./components/ChannelsPanel";
import { CronDialog } from "./components/CronDialog";
import { CronPanel } from "./components/CronPanel";
import { CronRunsDialog } from "./components/CronRunsDialog";
import { NodesPanel } from "./components/NodesPanel";
import { useAgentsData, useAgentsExport } from "./hooks";

const AgentSkills = lazy(() => import("./components/AgentSkills"));

export function AgentsFeature() {
  const { t } = useTranslation("common");
  const data = useAgentsData();
  const { handleExport } = useAgentsExport(data);
  const { configError, cronDialogOpen, setCronDialogOpen, handleOpenCronDialog } = data;

  const [editingAttribute, setEditingAttribute] = useState<AttributeType | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    ipc.workspace
      .list("memory")
      .then((result) => {
        setMemoryCount(result.files.filter((f) => !f.isDirectory && f.name.endsWith(".md")).length);
      })
      .catch(() => setMemoryCount(0));
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top: Agent Switcher */}
      <div className="flex items-center justify-between pr-4">
        <AgentSwitcher />
        <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0">
          <Download className="w-4 h-4 mr-2" />
          {t("agents.actions.exportJson")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 pb-6">
          {configError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
              <div className="font-medium text-destructive">{t("agents.errorTitle")}</div>
              <div className="text-sm text-destructive/90">{configError}</div>
            </div>
          )}

          {/* Hero: pixel avatar + attribute cards */}
          <AgentHero onOpenAttribute={setEditingAttribute} memoryCount={memoryCount} />

          {/* Bottom Tabs */}
          <Tabs defaultValue="capabilities">
            <TabsList className="w-full justify-start gap-1 h-auto p-1">
              <TabsTrigger value="capabilities" className="px-5 py-2.5 text-sm">
                {t("agents.agentDesktop.tabs.capabilities")}
              </TabsTrigger>
              <TabsTrigger value="skills" className="px-5 py-2.5 text-sm">
                {t("agents.agentDesktop.tabs.skills")}
              </TabsTrigger>
              <TabsTrigger value="channels" className="px-5 py-2.5 text-sm">
                {t("agents.agentDesktop.tabs.channels")}
              </TabsTrigger>
              <TabsTrigger value="nodes" className="px-5 py-2.5 text-sm">
                {t("agents.agentDesktop.tabs.nodes")}
              </TabsTrigger>
              <TabsTrigger value="cron" className="px-5 py-2.5 text-sm">
                {t("agents.agentDesktop.tabs.cron")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="capabilities" className="mt-4 space-y-4">
              <AgentCapabilities />
              <AgentExtensions />
            </TabsContent>

            <TabsContent value="skills" className="mt-4">
              <Suspense
                fallback={
                  <div className="flex h-[500px] items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <AgentSkills />
              </Suspense>
            </TabsContent>

            <TabsContent value="channels" className="mt-4">
              <ChannelsPanel />
            </TabsContent>

            <TabsContent value="nodes" className="mt-4">
              <NodesPanel />
            </TabsContent>

            <TabsContent value="cron" className="mt-4">
              <CronPanel onOpenDialog={handleOpenCronDialog} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <AttributeDialog type={editingAttribute} onClose={() => setEditingAttribute(null)} />
      <CronDialog open={cronDialogOpen} onOpenChange={setCronDialogOpen} />
      <CronRunsDialog />
    </div>
  );
}
