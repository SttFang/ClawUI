import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@clawui/ui";
import { Server } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import {
  useGatewayStore,
  selectGatewayStatus,
  selectGatewayError,
  selectIsGatewayRunning,
} from "@/store/gateway";

export function GatewayTab() {
  const { t } = useTranslation("common");

  const gatewayStatus = useGatewayStore(selectGatewayStatus);
  const gatewayError = useGatewayStore(selectGatewayError);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);
  const startGateway = useGatewayStore((s) => s.start);
  const stopGateway = useGatewayStore((s) => s.stop);

  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);

  const serviceAction = (action: () => Promise<void>, successKey: string, failKey: string) => {
    setServiceBusy(true);
    setServiceMessage(null);
    action()
      .then(() => setServiceMessage(t(successKey)))
      .catch((e) => setServiceMessage(e instanceof Error ? e.message : t(failKey)))
      .finally(() => setServiceBusy(false));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          <CardTitle>{t("settings.page.gateway.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.page.gateway.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                gatewayStatus === "running"
                  ? "bg-green-500"
                  : gatewayStatus === "starting"
                    ? "bg-amber-500 animate-pulse"
                    : gatewayStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-400"
              }`}
            />
            <span className="capitalize">
              {t(`settings.page.gateway.status.${gatewayStatus}`, {
                defaultValue: gatewayStatus,
              })}
            </span>
            {gatewayError && <span className="text-destructive"> - {gatewayError}</span>}
          </div>
          <Button
            variant={isGatewayRunning ? "destructive" : "default"}
            onClick={isGatewayRunning ? stopGateway : startGateway}
            disabled={gatewayStatus === "starting"}
          >
            {isGatewayRunning
              ? t("settings.page.gateway.actions.stopGateway")
              : t("settings.page.gateway.actions.startGateway")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={serviceBusy}
            onClick={() =>
              serviceAction(
                () => ipc.gateway.installService(),
                "settings.page.gateway.messages.serviceInstalled",
                "settings.page.gateway.messages.installFailed",
              )
            }
          >
            {t("settings.page.gateway.actions.installService")}
          </Button>
          <Button
            variant="outline"
            disabled={serviceBusy}
            onClick={() =>
              serviceAction(
                () => ipc.gateway.restartService(),
                "settings.page.gateway.messages.serviceRestarted",
                "settings.page.gateway.messages.restartFailed",
              )
            }
          >
            {t("settings.page.gateway.actions.restartService")}
          </Button>
          <Button
            variant="destructive"
            disabled={serviceBusy}
            onClick={() =>
              serviceAction(
                () => ipc.gateway.uninstallService(),
                "settings.page.gateway.messages.serviceUninstalled",
                "settings.page.gateway.messages.uninstallFailed",
              )
            }
          >
            {t("settings.page.gateway.actions.uninstallService")}
          </Button>
        </div>

        {serviceMessage ? (
          <div className="text-sm text-muted-foreground">{serviceMessage}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
