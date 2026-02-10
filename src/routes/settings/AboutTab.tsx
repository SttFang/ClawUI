import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@clawui/ui";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";

export function AboutTab() {
  const { t } = useTranslation("common");
  const [version, setVersion] = useState("0.0.0");

  useEffect(() => {
    ipc.app.getVersion().then(setVersion);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <CardTitle>{t("settings.page.about.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">ClawUI</p>
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
  );
}
