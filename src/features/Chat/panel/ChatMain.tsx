import { ConfigBanner } from "@/components/ConfigBanner";
import { OpenClawChatPanel } from "../components/OpenClawChatPanel";
import { useChatFeature } from "../useChatFeature";

export function ChatMain() {
  const {
    sessionState: { currentSessionId },
    uiState: { wsConnected, isGatewayRunning, configValid, showBanner },
    uiActions: { onDismissBanner, onOneClickConfig, onManualConfig, onStartConversation },
  } = useChatFeature();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {configValid === false && showBanner ? (
        <div className="p-4 pb-0">
          <ConfigBanner
            onDismiss={onDismissBanner}
            onOneClick={onOneClickConfig}
            onManualConfig={onManualConfig}
          />
        </div>
      ) : null}

      <OpenClawChatPanel
        key={currentSessionId ?? "draft"}
        sessionKey={currentSessionId}
        wsConnected={wsConnected}
        isGatewayRunning={isGatewayRunning}
        onStartConversation={onStartConversation}
      />
    </div>
  );
}
