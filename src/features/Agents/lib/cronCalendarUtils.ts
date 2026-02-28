import type { CronJob } from "@/store/agents/types";

/** Date key: "YYYY-MM-DD" */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar grid: 42 cells (null = blank, number = day of month) */
export function getCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array<null>(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length < 42) grid.push(null);
  return grid;
}

const MS_PER_DAY = 86_400_000;

/** Compute dates a job runs in a given month */
export function getJobDatesInMonth(job: CronJob, year: number, month: number): Date[] {
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  const next = job.state?.nextRunAtMs;

  if (job.schedule.kind === "every" && next) {
    const interval = job.schedule.everyMs;
    if (interval >= MS_PER_DAY) {
      const dates: Date[] = [];
      let t = next;
      while (t > monthStart) t -= interval;
      if (t < monthStart) t += interval;
      while (t <= monthEnd) {
        dates.push(new Date(t));
        t += interval;
      }
      return dates;
    }
    // interval < 1 day: runs every day
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  }

  if (job.schedule.kind === "at") {
    const t = new Date(job.schedule.at).getTime();
    if (t >= monthStart && t <= monthEnd) return [new Date(t)];
    return [];
  }

  // cron expression / fallback: only mark nextRunAtMs
  if (next && next >= monthStart && next <= monthEnd) return [new Date(next)];
  return [];
}

/** Group jobs by date key */
export function buildJobsByDate(
  jobs: CronJob[],
  year: number,
  month: number,
): Map<string, CronJob[]> {
  const map = new Map<string, CronJob[]>();
  for (const job of jobs) {
    for (const d of getJobDatesInMonth(job, year, month)) {
      const key = dateKey(d);
      const arr = map.get(key) ?? [];
      arr.push(job);
      map.set(key, arr);
    }
  }
  return map;
}
