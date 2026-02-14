import type { CostDailyEntry, UsageTotals, UsageAggregates } from "@clawui/types/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@clawui/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@clawui/ui/chart";
import { Coins, Hash, MessageSquare, Timer } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatTokens, formatLatency } from "@/lib/format";

type Granularity = "hour" | "day" | "month";

interface DailyTrendChartProps {
  data: CostDailyEntry[];
  mode: "tokens" | "cost";
  totals: UsageTotals | null;
  aggregates: UsageAggregates | null;
  sessionCount: number;
}

const DATA_KEYS = ["output", "input", "cacheWrite", "cacheRead"] as const;
const BAR_SIZE = 26;

/** Compute cumulative y-values so connectors land on stacked bar top vertices. */
function addStackTops<T extends Record<string, unknown>>(row: T) {
  const o = Number(row.output) || 0;
  const i = Number(row.input) || 0;
  const cw = Number(row.cacheWrite) || 0;
  const cr = Number(row.cacheRead) || 0;
  return {
    ...row,
    output_top: o,
    input_top: o + i,
    cacheWrite_top: o + i + cw,
    cacheRead_top: o + i + cw + cr,
  };
}

function formatDateByGranularity(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr);
  switch (granularity) {
    case "hour":
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:00`;
    case "day":
      return `${d.getMonth() + 1}/${d.getDate()}`;
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function formatMonthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-");
  const yearShort = y.slice(2);
  const month = parseInt(m, 10);

  if (locale.toLowerCase().startsWith("zh")) {
    return `${yearShort}年${month}月`;
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[month - 1]} ${yearShort}`;
}

function formatValue(value: number, mode: "tokens" | "cost"): string {
  if (mode === "cost") return `$${value.toFixed(2)}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function BarEdgeConnectorShape(props: any & { barSize: number }) {
  const { points, stroke, strokeWidth, strokeDasharray, barSize } = props ?? {};
  if (!Array.isArray(points) || points.length < 2) return null;

  const halfBar = (typeof barSize === "number" ? barSize : 0) / 2;
  const dash = strokeDasharray ?? "4 3";
  const width = strokeWidth ?? 1.5;

  return (
    <g style={{ pointerEvents: "none" }}>
      {points.slice(0, -1).map((p1: any, i: number) => {
        const p2 = points[i + 1];
        if (!p1 || !p2) return null;
        if (p1.x == null || p1.y == null || p2.x == null || p2.y == null) return null;

        // Recharts line points are centered on each category tick.
        // Shift endpoints to connect bar edges instead of center-to-center.
        const x1 = Number(p1.x) + halfBar;
        const y1 = Number(p1.y);
        const x2 = Number(p2.x) - halfBar;
        const y2 = Number(p2.y);
        if (
          !Number.isFinite(x1) ||
          !Number.isFinite(y1) ||
          !Number.isFinite(x2) ||
          !Number.isFinite(y2)
        ) {
          return null;
        }

        const dx = (x2 - x1) * 0.2;

        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
            stroke={stroke}
            strokeWidth={width}
            strokeDasharray={dash}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
        );
      })}
    </g>
  );
}

function aggregateByMonth(
  data: CostDailyEntry[],
  mode: "tokens" | "cost",
  locale: string,
): Array<{ date: string; output: number; input: number; cacheWrite: number; cacheRead: number }> {
  const grouped = new Map<
    string,
    { output: number; input: number; cacheWrite: number; cacheRead: number }
  >();

  for (const d of data) {
    const key = getMonthKey(d.date);
    const existing = grouped.get(key) ?? { output: 0, input: 0, cacheWrite: 0, cacheRead: 0 };
    existing.output += mode === "cost" ? d.outputCost : d.output;
    existing.input += mode === "cost" ? d.inputCost : d.input;
    existing.cacheWrite += mode === "cost" ? d.cacheWriteCost : d.cacheWrite;
    existing.cacheRead += mode === "cost" ? d.cacheReadCost : d.cacheRead;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      date: formatMonthLabel(key, locale),
      ...values,
    }));
}

export function DailyTrendChart({
  data,
  mode,
  totals,
  aggregates,
  sessionCount,
}: DailyTrendChartProps) {
  const { t, i18n } = useTranslation("common");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const locale = i18n.language;

  const chartConfig = useMemo(
    () =>
      ({
        output: { label: t("usage.metrics.output"), color: "var(--chart-1)" },
        input: { label: t("usage.metrics.input"), color: "var(--chart-2)" },
        cacheWrite: { label: t("usage.metrics.cacheWrite"), color: "var(--chart-3)" },
        cacheRead: { label: t("usage.metrics.cacheRead"), color: "var(--chart-4)" },
      }) satisfies ChartConfig,
    [locale, t],
  );

  const granularityOptions: Array<{ value: Granularity; label: string }> = useMemo(
    () => [
      { value: "hour", label: t("usage.granularity.hour") },
      { value: "day", label: t("usage.granularity.day") },
      { value: "month", label: t("usage.granularity.month") },
    ],
    [locale, t],
  );

  const chartData = useMemo(() => {
    if (granularity === "month") {
      return aggregateByMonth(data, mode, locale).map(addStackTops);
    }
    return data
      .map((d) => ({
        date: formatDateByGranularity(d.date, granularity),
        output: mode === "cost" ? d.outputCost : d.output,
        input: mode === "cost" ? d.inputCost : d.input,
        cacheWrite: mode === "cost" ? d.cacheWriteCost : d.cacheWrite,
        cacheRead: mode === "cost" ? d.cacheReadCost : d.cacheRead,
      }))
      .map(addStackTops);
  }, [data, mode, granularity, locale]);

  const stats = useMemo(
    () => [
      {
        icon: Hash,
        label: t("usage.trend.tokens"),
        value: totals ? formatTokens(totals.totalTokens) : "-",
        color: "text-blue-500",
      },
      {
        icon: Coins,
        label: t("usage.trend.cost"),
        value: totals ? `$${totals.totalCost.toFixed(2)}` : "-",
        color: "text-amber-500",
      },
      {
        icon: MessageSquare,
        label: t("usage.summary.sessions"),
        value: String(sessionCount),
        color: "text-green-500",
      },
      {
        icon: Timer,
        label: t("usage.trend.latency"),
        value: formatLatency(aggregates?.latency?.avgMs),
        color: "text-purple-500",
      },
    ],
    [totals, aggregates, sessionCount, locale, t],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {t("usage.trend.title", {
              mode: mode === "cost" ? t("usage.trend.cost") : t("usage.trend.tokens"),
            })}
          </CardTitle>
          <div className="flex items-center gap-1">
            {granularityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  granularity === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <s.icon size={14} className={s.color} />
              <div className="text-right">
                <p className="text-[10px] leading-tight text-muted-foreground">{s.label}</p>
                <p className="text-sm font-semibold leading-tight">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[280px] w-full">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatValue(v as number, mode)} />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(value) => formatValue(Number(value ?? 0), mode)} />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Stacked bars */}
            {DATA_KEYS.map((key) => (
              <Bar
                key={`bar-${key}`}
                dataKey={key}
                stackId="stack"
                fill={`var(--color-${key})`}
                barSize={BAR_SIZE}
                radius={key === "cacheRead" ? [2, 2, 0, 0] : undefined}
              />
            ))}
            {/* Dashed connectors: from right-top vertex of current bar to left-top vertex of next bar */}
            {DATA_KEYS.map((key) => (
              <Line
                key={`line-${key}`}
                type="monotone"
                dataKey={`${key}_top`}
                stroke={`var(--color-${key})`}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                legendType="none"
                isAnimationActive={false}
                shape={(p: any) => <BarEdgeConnectorShape {...p} barSize={BAR_SIZE} />}
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
