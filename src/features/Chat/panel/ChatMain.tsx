import { useTranslation } from "react-i18next";
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
  } = props;
  const { t } = useTranslation("chat");

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

      {currentSessionId ? (
        <OpenClawChatPanel
          key={currentSessionId}
          sessionKey={currentSessionId}
          wsConnected={wsConnected}
          isGatewayRunning={isGatewayRunning}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {t("createSessionHint")}
        </div>
      )}
    </div>
  );
}

