import type { UsageTotals } from "@clawui/types/usage";
import { Card, CardContent, CardHeader, CardTitle } from "@clawui/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@clawui/ui/chart";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, Label } from "recharts";
import { formatTokens } from "@/lib/format";

interface CostBreakdownProps {
  totals: UsageTotals | null;
}

const PIE_KEYS = ["output", "input", "cacheWrite", "cacheRead"] as const;

export function CostBreakdown({ totals }: CostBreakdownProps) {
  const { t, i18n } = useTranslation("common");

  if (!totals) return null;
  const chartConfig = useMemo(
    () =>
      ({
        output: { label: t("usage.metrics.output"), color: "var(--chart-1)" },
        input: { label: t("usage.metrics.input"), color: "var(--chart-2)" },
        cacheWrite: { label: t("usage.metrics.cacheWrite"), color: "var(--chart-3)" },
        cacheRead: { label: t("usage.metrics.cacheRead"), color: "var(--chart-4)" },
      }) satisfies ChartConfig,
    [i18n.language, t],
  );

  const pieData = PIE_KEYS.map((key) => ({
    key,
    name: chartConfig[key].label,
    value: totals[key],
    fill: `var(--color-${key})`,
  }));

  const totalTokens = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("usage.costBreakdown.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatTokens(Number(value ?? 0))}
                  nameKey="name"
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={80}
              strokeWidth={2}
            >
              {pieData.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-bold"
                        >
                          {formatTokens(totalTokens)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          {t("usage.costBreakdown.centerLabel")}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
