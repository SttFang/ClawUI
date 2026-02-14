import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { formatCronSchedule, formatTimestamp } from "@/routes/agents/cronFormat";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

interface CronDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CronDialog({ open, onOpenChange }: CronDialogProps) {
  const { t } = useTranslation("common");
  const cronStatus = useAgentsStore(agentsSelectors.selectCronStatus);
  const cronJobs = useAgentsStore(agentsSelectors.selectCronJobs);
  const cronError = useAgentsStore(agentsSelectors.selectCronError);
  const cronBusyJobId = useAgentsStore(agentsSelectors.selectCronBusyJobId);
  const loadCronStatus = useAgentsStore((s) => s.loadCronStatus);
  const loadCronJobs = useAgentsStore((s) => s.loadCronJobs);
  const toggleCronJob = useAgentsStore((s) => s.toggleCronJob);
  const runCronJob = useAgentsStore((s) => s.runCronJob);
  const removeCronJob = useAgentsStore((s) => s.removeCronJob);
  const loadCronRuns = useAgentsStore((s) => s.loadCronRuns);
  const clearCronError = useAgentsStore((s) => s.clearCronError);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t("agents.cron.panelTitle")}</DialogTitle>
          <DialogDescription>{t("agents.cron.panelDescription")}</DialogDescription>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {t("agents.cron.statusLine", {
                enabled: cronStatus?.enabled
                  ? t("agents.values.enabled")
                  : t("agents.values.disabled"),
                jobs: cronStatus?.jobs ?? 0,
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                clearCronError();
                await Promise.all([loadCronStatus(), loadCronJobs()]);
              }}
            >
              {t("agents.cron.refresh")}
            </Button>
          </div>

          {cronError && (
            <div className="text-sm text-destructive">
              {t("agents.cron.loadFailed")}: {cronError}
            </div>
          )}

          <div className="space-y-2">
            {(cronJobs ?? []).map((job) => {
              const busy = cronBusyJobId === job.id;
              const nextRun = formatTimestamp(job.state?.nextRunAtMs);
              const lastRun = formatTimestamp(job.state?.lastRunAtMs);
              const lastStatus = job.state?.lastStatus ?? "\u2014";

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
                          <span className="font-mono">{job.id}</span>
                        </div>
                        <div>
                          {t("agents.cron.schedule")}:{" "}
                          <span className="font-mono">{formatCronSchedule(job.schedule)}</span>
                        </div>
                        <div>
                          {t("agents.cron.nextRun")}: <span className="font-mono">{nextRun}</span>
                        </div>
                        <div>
                          {t("agents.cron.lastRun")}: <span className="font-mono">{lastRun}</span>
                          <span className="ml-2">
                            {t("agents.cron.lastStatus")}: {lastStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {t("agents.cron.enabled")}
                        </span>
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={(checked) => toggleCronJob(job.id, checked)}
                          disabled={busy}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => runCronJob(job.id)}
                        >
                          {t("agents.cron.runNow")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => loadCronRuns(job.id)}
                        >
                          {t("agents.cron.viewRuns")}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const ok = window.confirm(t("agents.cron.confirmRemove"));
                            if (ok) removeCronJob(job.id);
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

            {(cronJobs?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">{t("agents.cron.empty")}</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
