import type { ChatFeatureProps } from "./types";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature(props: ChatFeatureProps) {
  const {
    sessionState: { sessions, currentSessionId, sessionFilter, sessionMetadata, metaBusyByKey },
    sessionActions: {
      onSessionFilterChange,
      onCreateSession,
      onSelectSession,
      onRenameSession,
      onDeleteSession,
      onGenerateMetadata,
    },
    uiState: { wsConnected, isGatewayRunning, configValid, showBanner },
    uiActions: { onDismissBanner, onOneClickConfig, onManualConfig, onStartConversation },
  } = props;

  return (
    <ChatShell
      sidebar={
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          sessionFilter={sessionFilter}
          sessionMetadata={sessionMetadata}
          metaBusyByKey={metaBusyByKey}
          onSessionFilterChange={onSessionFilterChange}
          onCreateSession={onCreateSession}
          onSelectSession={onSelectSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          onGenerateMetadata={onGenerateMetadata}
        />
      }
      main={
        <ChatMain
          currentSessionId={currentSessionId}
          wsConnected={wsConnected}
          isGatewayRunning={isGatewayRunning}
          configValid={configValid}
          showBanner={showBanner}
          onDismissBanner={onDismissBanner}
          onOneClickConfig={onOneClickConfig}
          onManualConfig={onManualConfig}
          onStartConversation={onStartConversation}
        />
      }
    />
  );
}
