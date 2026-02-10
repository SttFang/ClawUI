import type { UsageTimeSeries } from "@clawui/types/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@clawui/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@clawui/ui/chart";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface SessionTimelineProps {
  timeSeries: UsageTimeSeries | null;
  loading: boolean;
  mode: "tokens" | "cost";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function SessionTimeline({ timeSeries, loading, mode }: SessionTimelineProps) {
  const { t, i18n } = useTranslation("common");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!timeSeries || timeSeries.points.length === 0) return null;

  const chartConfig = useMemo(
    () =>
      ({
        output: { label: t("usage.metrics.output"), color: "var(--chart-1)" },
        input: { label: t("usage.metrics.input"), color: "var(--chart-2)" },
        cacheRead: { label: t("usage.metrics.cacheRead"), color: "var(--chart-4)" },
        cumulative: { label: t("usage.metrics.cumulative"), color: "var(--chart-5)" },
      }) satisfies ChartConfig,
    [i18n.language, t],
  );

  const chartData = timeSeries.points.map((p) => ({
    time: formatTime(p.timestamp),
    output: mode === "cost" ? p.cost : p.output,
    input: mode === "cost" ? 0 : p.input,
    cacheRead: mode === "cost" ? 0 : p.cacheRead,
    cumulative: mode === "cost" ? p.cumulativeCost : p.cumulativeTokens,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("usage.sessionTimeline.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[240px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {mode === "tokens" && (
              <>
                <Line
                  type="monotone"
                  dataKey="output"
                  stroke="var(--color-output)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="input"
                  stroke="var(--color-input)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cacheRead"
                  stroke="var(--color-cacheRead)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="var(--color-cumulative)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
