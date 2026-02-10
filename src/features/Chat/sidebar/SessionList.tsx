import type { ClawUISessionMetadata } from "@clawui/types/clawui";
import type { SessionListItem } from "../types";
import { SessionItem } from "./SessionItem";

export function SessionList(props: {
  sessions: SessionListItem[];
  currentSessionId: string | null;
  sessionMetadata: Record<string, ClawUISessionMetadata>;
  metaBusyByKey: Record<string, boolean>;
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
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    onGenerateMetadata,
  } = props;

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
