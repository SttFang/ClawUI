import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
} from "@clawui/ui";
import { ChevronRight, Plus } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { useChatFeature } from "../useChatFeature";
import { AgentTabs } from "./AgentTabs";
import { CronResultList } from "./CronResultList";
import { SessionList } from "./SessionList";
import { WorkspaceFileList } from "./WorkspaceFileList";

export function SessionSidebar() {
  const {
    sessionActions: { onCreateSession },
  } = useChatFeature();

  const { t } = useTranslation("chat");
  const loadFiles = useWorkspaceFilesStore((s) => s.loadFiles);
  const selectedAgentId = useAgentsStore(agentsSelectors.selectSelectedAgentId);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles, selectedAgentId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-r bg-card">
      <AgentTabs />
      <ResizablePanelGroup id="sidebar-layout" orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel id="sessions" defaultSize="65%" minSize="80px">
          <ScrollArea className="h-full">
            <Collapsible defaultOpen>
              <div className="flex w-full items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground">
                <CollapsibleTrigger className="flex flex-1 items-center gap-1 hover:text-foreground">
                  <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                  <span className="flex-1 text-left">{t("sessionList")}</span>
                </CollapsibleTrigger>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                  onClick={onCreateSession}
                  aria-label={t("newSession")}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <CollapsibleContent>
                <div className="px-2 pb-2 space-y-0.5">
                  <SessionList />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="workspace-files" defaultSize="35%" minSize="40px">
          <div className="flex h-full min-h-0 flex-col">
            <WorkspaceFileList />
            <CronResultList />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
