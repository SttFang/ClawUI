import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
} from "@clawui/ui";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, selectAutoStartGateway, selectAutoCheckUpdates } from "@/store/settings";
import { useUIStore, selectTheme, type Theme } from "@/store/ui";

export function GeneralTab() {
  const { t } = useTranslation("common");

  const theme = useUIStore(selectTheme);
  const setTheme = useUIStore((s) => s.setTheme);
  const autoStartGateway = useSettingsStore(selectAutoStartGateway);
  const autoCheckUpdates = useSettingsStore(selectAutoCheckUpdates);
  const setAutoStartGateway = useSettingsStore((s) => s.setAutoStartGateway);
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: t("settings.page.theme.light"), icon: <Sun className="h-4 w-4" /> },
    { value: "dark", label: t("settings.page.theme.dark"), icon: <Moon className="h-4 w-4" /> },
    {
      value: "system",
      label: t("settings.page.theme.system"),
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  return (
    <>
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

      <Card className="mt-4">
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
    </>
  );
}
