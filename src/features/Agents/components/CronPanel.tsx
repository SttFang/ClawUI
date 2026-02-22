import { Button } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/routes/agents/cronFormat";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

interface CronPanelProps {
  onOpenDialog: () => void;
}

export function CronPanel({ onOpenDialog }: CronPanelProps) {
  const { t } = useTranslation("common");
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const cronError = useAgentsStore(agentsSelectors.selectCronError);

  const enabledLabel = cronStatus
    ? cronStatus.enabled
      ? t("agents.values.enabled")
      : t("agents.values.disabled")
    : "\u2014";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={`size-1.5 rounded-full ${cronStatus?.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          <span>{enabledLabel}</span>
          <span>·</span>
          <span>
            {t("agents.cron.jobs")} {cronStatus?.jobs ?? "\u2014"}
          </span>
          <span>·</span>
          <span>
            {t("agents.cron.nextWake")}{" "}
            {cronStatus ? formatTimestamp(cronStatus.nextWakeAtMs ?? null) : "\u2014"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenDialog}>
          {t("agents.cron.openPanel")}
        </Button>
      </div>

      {cronError && (
        <div className="px-1 text-sm text-destructive">
          {t("agents.cron.loadFailed")}: {cronError}
        </div>
      )}
    </div>
  );
}
