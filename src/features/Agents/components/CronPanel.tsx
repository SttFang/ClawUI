import { Button } from "@clawui/ui";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/routes/agents/cronFormat";
import { useCronCalendarData } from "../hooks/useCronCalendarData";
import { CronCalendar } from "./CronCalendar";
import { CronDayJobs } from "./CronDayJobs";

interface CronPanelProps {
  onOpenDialog: () => void;
}

export function CronPanel({ onOpenDialog }: CronPanelProps) {
  const { t } = useTranslation("common");
  const data = useCronCalendarData();

  const enabledLabel = data.cronStatus
    ? data.cronStatus.enabled
      ? t("agents.values.enabled")
      : t("agents.values.disabled")
    : "\u2014";

  return (
    <div className="flex flex-col gap-4">
      {/* Status summary + actions */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={`size-1.5 rounded-full ${data.cronStatus?.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          <span>{enabledLabel}</span>
          <span>·</span>
          <span>
            {t("agents.cron.jobs")} {data.cronStatus?.jobs ?? "\u2014"}
          </span>
          <span>·</span>
          <span>
            {t("agents.cron.nextWake")}{" "}
            {data.cronStatus ? formatTimestamp(data.cronStatus.nextWakeAtMs ?? null) : "\u2014"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => void data.refresh()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDialog}>
            {t("agents.cron.allJobs")}
          </Button>
        </div>
      </div>

      {data.cronError && (
        <div className="px-1 text-sm text-destructive">
          {t("agents.cron.loadFailed")}: {data.cronError}
        </div>
      )}

      {/* Calendar grid */}
      <CronCalendar
        month={data.currentMonth}
        jobsByDate={data.jobsByDate}
        selectedDate={data.selectedDate}
        onSelectDate={data.setSelectedDate}
        onPrevMonth={data.prevMonth}
        onNextMonth={data.nextMonth}
        onGoToday={data.goToday}
      />

      {/* Selected date job list */}
      {data.selectedDate && (
        <CronDayJobs
          date={data.selectedDate}
          jobs={data.selectedDateJobs}
          busyJobId={data.cronBusyJobId}
          onToggle={data.toggleCronJob}
          onRun={data.runCronJob}
          onRemove={data.removeCronJob}
          onViewRuns={data.loadCronRuns}
        />
      )}
    </div>
  );
}
