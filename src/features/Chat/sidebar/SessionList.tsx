import { useTranslation } from "react-i18next";
import { useChatFeature } from "../useChatFeature";
import { SessionItem } from "./SessionItem";

export function SessionList() {
  const {
    sessionState: { sessions, currentSessionId, sessionMetadata, metaBusyByKey },
    sessionActions: { onSelectSession, onRenameSession, onDeleteSession, onGenerateMetadata },
  } = useChatFeature();

  const { t } = useTranslation("chat");

  if (sessions.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-8">{t("noSessions")}</div>;
  }

  return sessions.map((session) => (
    <SessionItem
      key={session.id}
      session={session}
      selected={currentSessionId === session.id}
      metadata={sessionMetadata[session.id]}
      metaBusy={Boolean(metaBusyByKey[session.id])}
      onSelect={() => onSelectSession(session.id)}
      onRename={(label) => onRenameSession(session.id, label)}
      onGenerateMetadata={() => onGenerateMetadata(session.id)}
      onDelete={() => onDeleteSession(session.id)}
    />
  ));
}
