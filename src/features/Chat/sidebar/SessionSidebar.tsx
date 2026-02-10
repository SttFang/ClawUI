import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, ScrollArea, Tabs, TabsList, TabsTrigger } from "@clawui/ui";
import type { SessionFilter, SessionListItem } from "../types";
import { SessionList } from "./SessionList";

export function SessionSidebar(props: {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  sessionFilter: SessionFilter;
  sessionMetadata: Record<string, ClawUISessionMetadata>;
  metaBusyByKey: Record<string, boolean>;
  onSessionFilterChange: (filter: SessionFilter) => void;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onGenerateMetadata: (id: string) => void;
}) {
  const {
    sessions,
    currentSessionId,
    sessionFilter,
    sessionMetadata,
    metaBusyByKey,
    onSessionFilterChange,
    onCreateSession,
    onSelectSession,
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

        <div className="mt-3">
          <Tabs
            value={sessionFilter}
            onValueChange={(v) => onSessionFilterChange(v as typeof sessionFilter)}
          >
            <TabsList className="w-full justify-between">
              <TabsTrigger value="ui" className="flex-1 justify-center">
                {t("sessionFilters.ui")}
              </TabsTrigger>
              <TabsTrigger value="discord" className="flex-1 justify-center">
                {t("sessionFilters.discord")}
              </TabsTrigger>
              <TabsTrigger value="all" className="flex-1 justify-center">
                {t("sessionFilters.all")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {t("noSessions")}
            </div>
          ) : (
            <SessionList
              sessions={sessions}
              currentSessionId={currentSessionId}
              sessionMetadata={sessionMetadata}
              metaBusyByKey={metaBusyByKey}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
              onGenerateMetadata={onGenerateMetadata}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

