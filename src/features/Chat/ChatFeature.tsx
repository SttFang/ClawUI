import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { WorkspaceFilePanel } from "./panel/WorkspaceFilePanel";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature() {
  const hasOpenTabs = useWorkspaceFilesStore((s) => s.openTabs.length > 0);
  return (
    <ChatShell
      sidebar={<SessionSidebar />}
      main={<ChatMain />}
      panel={hasOpenTabs ? <WorkspaceFilePanel /> : undefined}
    />
  );
}
