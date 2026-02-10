import { describe, expect, test } from "vitest";
import { formatCronSchedule } from "../cronFormat";

describe("formatCronSchedule", () => {
  test("formats every schedule in minutes when divisible by 60s", () => {
    expect(formatCronSchedule({ kind: "every", everyMs: 60_000 })).toBe("every 1m");
    expect(formatCronSchedule({ kind: "every", everyMs: 5 * 60_000 })).toBe("every 5m");
  });

  test("formats every schedule in seconds when divisible by 1s", () => {
    expect(formatCronSchedule({ kind: "every", everyMs: 30_000 })).toBe("every 30s");
  });

  test("formats cron expressions", () => {
    expect(formatCronSchedule({ kind: "cron", expr: "0 0 * * *", tz: "UTC" })).toBe(
      "cron 0 0 * * * (UTC)",
    );
  });
});
