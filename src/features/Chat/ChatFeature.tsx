import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { WorkspaceFilePanel } from "./panel/WorkspaceFilePanel";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature() {
  const activeFilePath = useWorkspaceFilesStore((s) => s.activeFilePath);
  return (
    <ChatShell
      sidebar={<SessionSidebar />}
      main={<ChatMain />}
      panel={activeFilePath ? <WorkspaceFilePanel /> : undefined}
    />
  );
}
