import type { ChatFeatureProps } from "./types";
import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature(props: ChatFeatureProps) {
  const {
    sessions,
    currentSessionId,
    wsConnected,
    isGatewayRunning,
    configValid,
    showBanner,
    onDismissBanner,
    onOneClickConfig,
    onManualConfig,
    sessionFilter,
    onSessionFilterChange,
    onCreateSession,
    onStartConversation,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    onGenerateMetadata,
    sessionMetadata,
    metaBusyByKey,
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
