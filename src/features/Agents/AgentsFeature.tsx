import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@clawui/ui";
import { Loader2, Settings } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { AgentHero, type AttributeType } from "./components/AgentHero";
import { AgentSwitcher } from "./components/AgentSwitcher";
import { AttributeSheet } from "./components/AttributeSheet";
import { ChannelsPanel } from "./components/ChannelsPanel";
import { CronDialog } from "./components/CronDialog";
import { CronPanel } from "./components/CronPanel";
import { CronRunsDialog } from "./components/CronRunsDialog";
import { NodesPanel } from "./components/NodesPanel";
import { StatusBar } from "./components/StatusBar";
import { useAgentsData, useAgentsExport } from "./hooks";

const AgentSkills = lazy(() => import("./components/AgentSkills"));

export function AgentsFeature() {
  const { t } = useTranslation("common");
  const data = useAgentsData();
  const { handleExport } = useAgentsExport(data);
  const { configError, cronDialogOpen, setCronDialogOpen, handleOpenCronDialog } = data;
  const selectedAgent = useAgentsStore(agentsSelectors.selectSelectedAgent);
  const agentId = selectedAgent?.id ?? "main";

  const [editingAttribute, setEditingAttribute] = useState<AttributeType | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [activeTab, setActiveTab] = useState("skills");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ipc.workspace
      .list("memory", agentId)
      .then((result) => {
        setMemoryCount(result.files.filter((f) => !f.isDirectory && f.name.endsWith(".md")).length);
      })
      .catch(() => setMemoryCount(0));
  }, [agentId]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top: Agent Switcher (dropdown + more menu) */}
      <AgentSwitcher onExport={handleExport} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 pb-6">
          {/* Single error banner */}
          {configError && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="font-medium">{t("agents.errorTitle")}</span>
                <span className="text-destructive/80">{configError}</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="#/settings">
                  <Settings className="mr-1.5 size-3.5" />
                  {t("agents.actions.manageTools")}
                </a>
              </Button>
            </div>
          )}

          {/* Hero: identity bar + attribute cards */}
          <AgentHero onOpenAttribute={setEditingAttribute} memoryCount={memoryCount} />

          {/* Status overview bar */}
          <StatusBar onTabChange={handleTabChange} />

          {/* Bottom Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <div ref={tabsRef}>
              <TabsList className="w-full justify-start gap-1 h-auto p-1">
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
            </div>

            <div className={configError ? "pointer-events-none opacity-50" : undefined}>
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
            </div>
          </Tabs>
        </div>
      </div>

      {/* Sheet (replaces Dialog) */}
      <AttributeSheet
        type={editingAttribute}
        onClose={() => setEditingAttribute(null)}
        agentId={agentId}
      />
      <CronDialog open={cronDialogOpen} onOpenChange={setCronDialogOpen} />
      <CronRunsDialog />
    </div>
  );
}
