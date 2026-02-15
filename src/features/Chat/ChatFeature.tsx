import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { WorkspaceFilePanel } from "./panel/WorkspaceFilePanel";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature() {
  const activeFileName = useWorkspaceFilesStore((s) => s.activeFileName);
  return (
    <ChatShell
      sidebar={<SessionSidebar />}
      main={<ChatMain />}
      panel={activeFileName ? <WorkspaceFilePanel /> : undefined}
    />
  );
}
