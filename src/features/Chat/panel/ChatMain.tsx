import { ConfigBanner } from "@/components/ConfigBanner";
import { OpenClawChatPanel } from "../components/OpenClawChatPanel";

export function ChatMain(props: {
  currentSessionId: string | null;
  wsConnected: boolean;
  isGatewayRunning: boolean;
  configValid: boolean | null;
  showBanner: boolean;
  onDismissBanner: () => void;
  onOneClickConfig: () => void;
  onManualConfig: () => void;
  onStartConversation: (content: string) => Promise<void>;
}) {
  const {
    currentSessionId,
    wsConnected,
    isGatewayRunning,
    configValid,
    showBanner,
    onDismissBanner,
    onOneClickConfig,
    onManualConfig,
    onStartConversation,
  } = props;
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
