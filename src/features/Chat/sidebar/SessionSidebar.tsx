import { Button, ScrollArea } from "@clawui/ui";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceFilesStore } from "@/store/workspaceFiles";
import { useChatFeature } from "../useChatFeature";
import { SessionList } from "./SessionList";
import { WorkspaceFileList } from "./WorkspaceFileList";

export function SessionSidebar() {
  const {
    sessionActions: { onCreateSession },
  } = useChatFeature();

  const { t } = useTranslation("chat");
  const loadFiles = useWorkspaceFilesStore((s) => s.loadFiles);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  return (
    <div className="flex min-h-0 w-64 flex-col border-r bg-card">
      <div className="p-4 border-b">
        <Button onClick={onCreateSession} className="w-full" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          {t("newSession")}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2 space-y-1">
          <SessionList />
        </div>
        <WorkspaceFileList />
      </ScrollArea>
    </div>
  );
}
