import { Button } from "@clawui/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CronJob } from "@/store/agents/types";
import { cn } from "@/lib/utils";
import { getCalendarGrid, dateKey } from "../lib/cronCalendarUtils";

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
  const grid = getCalendarGrid(year, m);
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
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-1">
        {weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-px">
        {grid.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = new Date(year, m, day);
          const key = dateKey(d);
          const jobs = jobsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = selectedDate !== null && dateKey(selectedDate) === key;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(d)}
              className={cn(
                "relative h-10 rounded-md text-sm transition-colors",
                isToday && "font-bold",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && "hover:bg-muted",
              )}
            >
              {day}
              {jobs.length > 0 && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full",
                    jobs.some((j) => j.state?.lastStatus === "error")
                      ? "bg-destructive"
                      : jobs.some((j) => j.enabled)
                        ? "bg-green-500"
                        : "bg-muted-foreground/40",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
