import { useMemo, useState } from "react";
import { useAgentsStore } from "@/store/agents";
import { agentsSelectors } from "@/store/agents/selectors";
import { buildJobsByDate, dateKey } from "../lib/cronCalendarUtils";

export function useCronCalendarData() {
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

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const jobs = cronJobs ?? [];

  const jobsByDate = useMemo(() => buildJobsByDate(jobs, year, month), [jobs, year, month]);

  const selectedDateJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobsByDate.get(dateKey(selectedDate)) ?? [];
  }, [selectedDate, jobsByDate]);

  const refresh = async () => {
    clearCronError();
    await Promise.all([loadCronStatus(), loadCronJobs()]);
  };

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return {
    cronStatus,
    cronError,
    cronBusyJobId,
    currentMonth,
    selectedDate,
    jobsByDate,
    selectedDateJobs,
    prevMonth,
    nextMonth,
    goToday,
    setSelectedDate,
    refresh,
    toggleCronJob,
    runCronJob,
    removeCronJob,
    loadCronRuns,
  };
}
