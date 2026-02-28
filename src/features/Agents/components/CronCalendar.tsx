import { Button } from "@clawui/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CronJob } from "@/store/agents/types";
import { cn } from "@/lib/utils";
import { getCalendarRows, getJobPillVariant, dateKey } from "../lib/cronCalendarUtils";

const PILL_COLORS: Record<string, string> = {
  error: "bg-destructive/80 text-destructive-foreground",
  running: "bg-yellow-500/80 text-yellow-950",
  enabled: "bg-green-500/80 text-green-950",
  disabled: "bg-muted-foreground/30 text-muted-foreground",
};

const MAX_VISIBLE_PILLS = 2;

interface CronCalendarProps {
  month: Date;
  jobsByDate: Map<string, CronJob[]>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
}

export function CronCalendar({
  month,
  jobsByDate,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToday,
}: CronCalendarProps) {
  const { t } = useTranslation("common");
  const year = month.getFullYear();
  const m = month.getMonth();
  const rows = getCalendarRows(year, m);
  const todayKey = dateKey(new Date());
  const weekdays = t("agents.cron.weekdays").split(/(?=[\u4e00-\u9fff])|(?<=\w{2})/);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" onClick={onPrevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <button type="button" onClick={onGoToday} className="text-sm font-medium hover:underline">
          {year}年{m + 1}月
        </button>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b text-center text-xs text-muted-foreground">
        {weekdays.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 border-l">
        {rows.map((row, ri) =>
          row.map((day, ci) => {
            const isBlank = day === null;
            const d = isBlank ? null : new Date(year, m, day);
            const key = d ? dateKey(d) : "";
            const jobs = d ? (jobsByDate.get(key) ?? []) : [];
            const isToday = key === todayKey;
            const isSelected = selectedDate !== null && key !== "" && dateKey(selectedDate) === key;
            const overflow = Math.max(0, jobs.length - MAX_VISIBLE_PILLS);

            return (
              <button
                key={`${ri}-${ci}`}
                type="button"
                disabled={isBlank}
                onClick={() => d && onSelectDate(d)}
                className={cn(
                  "relative flex h-24 flex-col items-start border-b border-r p-1 text-left transition-colors",
                  isBlank && "cursor-default bg-muted/30",
                  !isBlank && !isSelected && "hover:bg-muted/50",
                  isSelected && "bg-accent/50",
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "mb-0.5 inline-flex items-center justify-center text-xs",
                    isBlank && "opacity-0",
                    isToday &&
                      "size-6 rounded-full bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {day ?? ""}
                </span>

                {/* Job pills */}
                <div className="flex w-full min-w-0 flex-col gap-0.5">
                  {jobs.slice(0, MAX_VISIBLE_PILLS).map((job) => (
                    <div
                      key={job.id}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                        PILL_COLORS[getJobPillVariant(job)],
                      )}
                    >
                      {job.name}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] leading-tight text-muted-foreground px-1">
                      {t("agents.cron.nMore", { n: overflow })}
                    </span>
                  )}
                </div>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
