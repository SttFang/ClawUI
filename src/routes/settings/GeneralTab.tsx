import {
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Switch,
} from "@clawui/ui";
import { OpenClaw } from "@lobehub/icons";
import { ChevronDown, Moon, Monitor, Server, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Subscription } from "@/features/Subscription";
import { ipc } from "@/lib/ipc";
import {
  useGatewayStore,
  selectGatewayStatus,
  selectGatewayError,
  selectIsGatewayRunning,
} from "@/store/gateway";
import { useSettingsStore, selectAutoStartGateway, selectAutoCheckUpdates } from "@/store/settings";
import { useUIStore, selectTheme, type Theme } from "@/store/ui";

export function GeneralTab() {
  const { t } = useTranslation("common");

  // Theme
  const theme = useUIStore(selectTheme);
  const setTheme = useUIStore((s) => s.setTheme);

  // Startup
  const autoStartGateway = useSettingsStore(selectAutoStartGateway);
  const autoCheckUpdates = useSettingsStore(selectAutoCheckUpdates);
  const setAutoStartGateway = useSettingsStore((s) => s.setAutoStartGateway);
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates);

  // Gateway
  const gatewayStatus = useGatewayStore(selectGatewayStatus);
  const gatewayError = useGatewayStore(selectGatewayError);
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning);
  const startGateway = useGatewayStore((s) => s.start);
  const stopGateway = useGatewayStore((s) => s.stop);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);

  // About
  const [version, setVersion] = useState("0.0.0");
  useEffect(() => {
    ipc.app.getVersion().then(setVersion);
  }, []);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: t("settings.page.theme.light"), icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: t("settings.page.theme.dark"), icon: <Moon className="h-4 w-4" /> },
    {
      value: "system",
      label: t("settings.page.theme.system"),
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  const serviceAction = (action: () => Promise<void>, successKey: string, failKey: string) => {
    setServiceBusy(true);
    setServiceMessage(null);
    action()
      .then(() => setServiceMessage(t(successKey)))
      .catch((e) => setServiceMessage(e instanceof Error ? e.message : t(failKey)))
      .finally(() => setServiceBusy(false));
  };

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          {t("settings.page.general.appearance.title")}
        </h3>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors ${
                theme === option.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Startup */}
      <section className="border-t pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          {t("settings.page.general.startup.title")}
        </h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {t("settings.page.general.startup.autoStartGateway")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("settings.page.general.startup.autoStartGatewayHint")}
              </div>
            </div>
            <Switch checked={autoStartGateway} onCheckedChange={setAutoStartGateway} />
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">
                {t("settings.page.general.startup.autoCheckUpdates")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("settings.page.general.startup.autoCheckUpdatesHint")}
              </div>
            </div>
            <Switch checked={autoCheckUpdates} onCheckedChange={setAutoCheckUpdates} />
          </div>
        </div>
      </section>

      {/* Gateway */}
      <section className="border-t pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          {t("settings.page.gateway.title")}
        </h3>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
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
                <span className="text-sm capitalize">
                  {t(`settings.page.gateway.status.${gatewayStatus}`, {
                    defaultValue: gatewayStatus,
                  })}
                </span>
                {gatewayError && (
                  <span className="text-sm text-destructive"> - {gatewayError}</span>
                )}
              </div>
              <Button
                size="sm"
                variant={isGatewayRunning ? "destructive" : "default"}
                onClick={isGatewayRunning ? stopGateway : startGateway}
                disabled={gatewayStatus === "starting"}
              >
                {isGatewayRunning
                  ? t("settings.page.gateway.actions.stopGateway")
                  : t("settings.page.gateway.actions.startGateway")}
              </Button>
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <ChevronDown className="h-3 w-3" />
                  {t("settings.page.general.serviceManagement")}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    size="sm"
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
                    size="sm"
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
                  <div className="text-sm text-muted-foreground mt-2">{serviceMessage}</div>
                ) : null}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </section>

      {/* Subscription */}
      <section className="border-t pt-6">
        <Subscription />
      </section>

      {/* About */}
      <section className="border-t pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          {t("settings.page.about.title")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <OpenClaw.Combine size={24} type="color" />
            <span className="text-sm text-muted-foreground">
              {t("settings.page.about.version", { version })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t("settings.page.about.description")}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => ipc.app.checkForUpdates()}>
              {t("settings.page.about.actions.checkForUpdates")}
            </Button>
            <Button variant="outline" size="sm">
              {t("settings.page.about.actions.viewLicense")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
