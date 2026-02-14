import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@clawui/ui";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/routes/agents/cronFormat";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function CronRunsDialog() {
  const { t } = useTranslation("common");
  const cronRunsData = useAgentsStore(agentsSelectors.selectCronRunsData);
  const clearCronRunsData = useAgentsStore((s) => s.clearCronRunsData);

  const open = !!cronRunsData;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && clearCronRunsData()}>
      <DialogContent className="max-w-2xl" onClose={clearCronRunsData}>
        <DialogHeader>
          <DialogTitle>{t("agents.cron.runsTitle")}</DialogTitle>
          <DialogDescription className="font-mono">{cronRunsData?.jobId ?? ""}</DialogDescription>
        </DialogHeader>
        <div className="p-6 pt-4 space-y-2">
          {(cronRunsData?.entries ?? []).map((e) => (
            <div key={`${e.ts}-${e.jobId}`} className="rounded-md border p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono">{formatTimestamp(e.ts)}</div>
                <div>{e.status}</div>
              </div>
              {e.summary && <div className="mt-1 text-muted-foreground">{e.summary}</div>}
              {e.error && <div className="mt-1 text-destructive">{e.error}</div>}
              {(e.sessionKey || e.sessionId) && (
                <div className="mt-1 text-muted-foreground font-mono">
                  {e.sessionKey ?? e.sessionId}
                </div>
              )}
            </div>
          ))}
          {(cronRunsData?.entries?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground">{t("agents.cron.runsEmpty")}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={clearCronRunsData}>
            {t("actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
