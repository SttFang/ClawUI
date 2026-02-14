import type { UsageAggregates } from "@clawui/types/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@clawui/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatCost, formatTokens } from "@/lib/format";

interface DailySignalsTableProps {
  daily: UsageAggregates["daily"];
}

function pct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function formatDayLabel(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (locale.toLowerCase().startsWith("zh")) return `${d.getMonth() + 1}/${d.getDate()}`;
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function DailySignalsTable({ daily }: DailySignalsTableProps) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n.language;
  if (!daily || daily.length === 0) return null;

  const rows = useMemo(() => {
    const slice = daily.slice(-14);
    return {
      slice,
      maxTokens: Math.max(...slice.map((d) => d.tokens ?? 0)),
      maxCost: Math.max(...slice.map((d) => d.cost ?? 0)),
      maxMessages: Math.max(...slice.map((d) => d.messages ?? 0)),
    };
  }, [daily]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("usage.dailySignals.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-5 gap-3 text-xs text-muted-foreground">
          <div>{t("usage.dailySignals.day")}</div>
          <div>{t("usage.dailySignals.tokens")}</div>
          <div>{t("usage.dailySignals.cost")}</div>
          <div>{t("usage.dailySignals.messages")}</div>
          <div>{t("usage.dailySignals.health")}</div>
        </div>

        <div className="space-y-2">
          {rows.slice.map((d) => (
            <div key={d.date} className="grid grid-cols-5 items-center gap-3">
              <div className="text-sm font-medium">{formatDayLabel(d.date, locale)}</div>

              <div className="space-y-1">
                <div className="text-sm tabular-nums">{formatTokens(d.tokens ?? 0)}</div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${pct(d.tokens ?? 0, rows.maxTokens)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm tabular-nums">{formatCost(d.cost ?? 0)}</div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-2)]"
                    style={{ width: `${pct(d.cost ?? 0, rows.maxCost)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm tabular-nums">{d.messages ?? 0}</div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--chart-3)]"
                    style={{ width: `${pct(d.messages ?? 0, rows.maxMessages)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-sm tabular-nums">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("usage.dailySignals.toolCallsShort")}
                  </span>
                  <span>{d.toolCalls ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t("usage.dailySignals.errorsShort")}
                  </span>
                  <span className={d.errors ? "text-red-600" : ""}>{d.errors ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{t("usage.dailySignals.hint")}</p>
      </CardContent>
    </Card>
  );
}
