import { useSubagentsStore, selectPanelOpen } from "@/store/subagents";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { SubagentPanel } from "./components/SubagentPanel";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { WorkspaceFilePanel } from "./panel/WorkspaceFilePanel";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature() {
  const hasOpenTabs = useWorkspaceFilesStore((s) => s.openTabs.length > 0);
  const subagentPanelOpen = useSubagentsStore(selectPanelOpen);

  const main = (
    <div className="flex min-h-0 flex-1">
      <ChatMain />
      {subagentPanelOpen && <SubagentPanel className="w-80" />}
    </div>
  );

  return (
    <ChatShell
      sidebar={<SessionSidebar />}
      main={main}
      panel={hasOpenTabs ? <WorkspaceFilePanel /> : undefined}
    />
  );
}
