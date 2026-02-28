import type { CronJob } from "@/store/agents/types";

export type JobPillVariant = "error" | "running" | "enabled" | "disabled";

export function getJobPillVariant(job: CronJob): JobPillVariant {
  if (job.state?.lastStatus === "error") return "error";
  if (job.state?.runningAtMs) return "running";
  if (job.enabled) return "enabled";
  return "disabled";
}

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

// --- lightweight cron expression expansion ---

// Check if `value` matches a single cron sub-field (e.g. "5", "1-15", "*/3")
function cronPartMatches(part: string, value: number): boolean {
  const [rangePart, stepStr] = part.split("/");
  const step = stepStr ? parseInt(stepStr) : 1;
  if (rangePart === "*") return step === 1 || value % step === 0;
  if (rangePart.includes("-")) {
    const [a, b] = rangePart.split("-").map(Number);
    return value >= a && value <= b && (value - a) % step === 0;
  }
  return parseInt(rangePart) === value;
}

/** Check if `value` matches a cron field (comma-separated parts) */
function cronFieldMatches(field: string, value: number): boolean {
  return field.split(",").some((p) => cronPartMatches(p.trim(), value));
}

/** Expand a 5-field cron expr into matching dates within a given month */
function expandCronInMonth(expr: string, year: number, month: number): Date[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return [];
  // 5-field: min hour dom month dow — 6-field: sec min hour dom month dow
  const off = parts.length >= 6 ? 1 : 0;
  const domField = parts[2 + off];
  const monthField = parts[3 + off];
  const dowField = parts[4 + off];

  // month field check (cron months are 1-12)
  if (monthField !== "*" && !cronFieldMatches(monthField, month + 1)) return [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: Date[] = [];
  const domRestricted = domField !== "*";
  const dowRestricted = dowField !== "*";

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay(); // 0=Sun
    const domOk = !domRestricted || cronFieldMatches(domField, d);
    const dowOk = !dowRestricted || cronFieldMatches(dowField, dow);
    // standard cron: both restricted → OR; one restricted → AND
    const match = domRestricted && dowRestricted ? domOk || dowOk : domOk && dowOk;
    if (match) dates.push(new Date(year, month, d));
  }
  return dates;
}

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

  if (job.schedule.kind === "cron") {
    return expandCronInMonth(job.schedule.expr, year, month);
  }

  // unknown kind fallback: only mark nextRunAtMs
  if (next && next >= monthStart && next <= monthEnd) return [new Date(next)];
  return [];
}

/** Calendar rows: 4-6 rows of 7 cells, trailing all-null rows trimmed */
export function getCalendarRows(year: number, month: number): (number | null)[][] {
  const flat = getCalendarGrid(year, month);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    rows.push(flat.slice(i, i + 7));
  }
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === null)) {
    rows.pop();
  }
  return rows;
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
