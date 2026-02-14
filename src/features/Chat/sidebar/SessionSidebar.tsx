import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { Button, ScrollArea } from "@clawui/ui";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionListItem } from "../types";
import { SessionList } from "./SessionList";

export function SessionSidebar(props: {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  sessionMetadata: Record<string, ClawUISessionMetadata>;
  metaBusyByKey: Record<string, boolean>;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, label: string) => void;
  onDeleteSession: (id: string) => void;
  onGenerateMetadata: (id: string) => void;
}) {
  const {
    sessions,
    currentSessionId,
    sessionMetadata,
    metaBusyByKey,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    onGenerateMetadata,
  } = props;

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
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">{t("noSessions")}</div>
          ) : (
            <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              sessionMetadata={sessionMetadata}
              metaBusyByKey={metaBusyByKey}
              onSelectSession={onSelectSession}
              onRenameSession={onRenameSession}
              onDeleteSession={onDeleteSession}
              onGenerateMetadata={onGenerateMetadata}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
