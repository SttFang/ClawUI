import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Label,
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
    <div className="space-y-4">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.general.appearance.title")}</CardTitle>
          <CardDescription>{t("settings.page.general.appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.page.general.appearance.theme")}</Label>
            <div className="flex gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
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
          </div>
        </CardContent>
      </Card>

      {/* Startup */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.general.startup.title")}</CardTitle>
          <CardDescription>{t("settings.page.general.startup.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("settings.page.general.startup.autoStartGateway")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.page.general.startup.autoStartGatewayHint")}
              </p>
            </div>
            <Switch checked={autoStartGateway} onCheckedChange={setAutoStartGateway} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("settings.page.general.startup.autoCheckUpdates")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.page.general.startup.autoCheckUpdatesHint")}
              </p>
            </div>
            <Switch checked={autoCheckUpdates} onCheckedChange={setAutoCheckUpdates} />
          </div>
        </CardContent>
      </Card>

      {/* Gateway (renamed: Connection Status) */}
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

      {/* Subscription */}
      <Subscription />

      {/* About */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <OpenClaw.Color size={20} />
            <CardTitle>{t("settings.page.about.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <OpenClaw.Combine size={24} type="color" />
            <p className="text-sm text-muted-foreground">
              {t("settings.page.about.version", { version })}
            </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
