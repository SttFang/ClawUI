import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";
import { formatTimestamp } from "../cronFormat";

interface CronPanelProps {
  onOpenDialog: () => void;
}

export function CronPanel({ onOpenDialog }: CronPanelProps) {
  const { t } = useTranslation("common");
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const cronError = useAgentsStore(agentsSelectors.selectCronError);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5" />
              {t("agents.sections.cron.title")}
            </CardTitle>
            <CardDescription>{t("agents.sections.cron.description")}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenDialog}>
            {t("agents.cron.openPanel")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {cronError && (
          <div className="text-sm text-destructive">
            {t("agents.cron.loadFailed")}: {cronError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t("agents.cron.enabled")}</div>
            <div className="font-medium">
              {cronStatus
                ? cronStatus.enabled
                  ? t("agents.values.enabled")
                  : t("agents.values.disabled")
                : "\u2014"}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t("agents.cron.jobs")}</div>
            <div className="font-medium">{cronStatus?.jobs ?? "\u2014"}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {t("agents.cron.nextWake")}:{" "}
          {cronStatus ? formatTimestamp(cronStatus.nextWakeAtMs ?? null) : "\u2014"}
        </div>
      </CardContent>
    </Card>
  );
}
