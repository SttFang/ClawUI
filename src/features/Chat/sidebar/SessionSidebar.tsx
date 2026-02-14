import { Button, ScrollArea } from "@clawui/ui";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChatFeature } from "../useChatFeature";
import { SessionList } from "./SessionList";

export function SessionSidebar() {
  const {
    sessionActions: { onCreateSession },
  } = useChatFeature();

  const { t } = useTranslation("chat");

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
      </ScrollArea>
    </div>
  );
}
