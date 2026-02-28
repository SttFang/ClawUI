import { Button, Switch } from "@clawui/ui";
import { useTranslation } from "react-i18next";
import type { CronJob } from "@/store/agents/types";
import { formatCronSchedule, formatTimestamp } from "@/routes/agents/cronFormat";

interface CronDayJobsProps {
  date: Date;
  jobs: CronJob[];
  busyJobId: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onRemove: (id: string) => void;
  onViewRuns: (id: string) => void;
}

export function CronDayJobs({
  date,
  jobs,
  busyJobId,
  onToggle,
  onRun,
  onRemove,
  onViewRuns,
}: CronDayJobsProps) {
  const { t } = useTranslation("common");

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("agents.cron.noJobsOnDate")}</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">
        {date.toLocaleDateString()} — {jobs.length} {t("agents.cron.jobs")}
      </h4>
      {jobs.map((job) => {
        const busy = busyJobId === job.id;
        return (
          <div key={job.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{job.name}</div>
                {job.description && (
                  <div className="text-sm text-muted-foreground">{job.description}</div>
                )}
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div>
                    {t("agents.cron.schedule")}:{" "}
                    <span className="font-mono">{formatCronSchedule(job.schedule)}</span>
                  </div>
                  <div>
                    {t("agents.cron.nextRun")}:{" "}
                    <span className="font-mono">{formatTimestamp(job.state?.nextRunAtMs)}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("agents.cron.enabled")}</span>
                  <Switch
                    checked={job.enabled}
                    onCheckedChange={(checked) => onToggle(job.id, checked)}
                    disabled={busy}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onRun(job.id)}>
                    {t("agents.cron.runNow")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onViewRuns(job.id)}
                  >
                    {t("agents.cron.viewRuns")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t("agents.cron.confirmRemove"))) onRemove(job.id);
                    }}
                  >
                    {t("agents.cron.remove")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
