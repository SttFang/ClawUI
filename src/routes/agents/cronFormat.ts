export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

function formatEvery(everyMs: number): string {
  if (!Number.isFinite(everyMs) || everyMs <= 0) return `${everyMs}`;
  if (everyMs % 60000 === 0) return `${everyMs / 60000}m`;
  if (everyMs % 1000 === 0) return `${everyMs / 1000}s`;
  return `${everyMs}ms`;
}

export function formatCronSchedule(schedule: CronSchedule | null | undefined): string {
  if (!schedule) return "—";
  if (schedule.kind === "at") return `at ${schedule.at}`;
  if (schedule.kind === "every") return `every ${formatEvery(schedule.everyMs)}`;
  if (schedule.kind === "cron")
    return `cron ${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ""}`;
  return "—";
}

export function formatTimestamp(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}
