import { PieChart, Pie, Cell, Label } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@clawui/ui/chart'
import type { UsageTotals } from '@clawui/types/usage'

interface CostBreakdownProps {
  totals: UsageTotals | null
}

const chartConfig = {
  output: { label: "Output", color: "var(--chart-1)" },
  input: { label: "Input", color: "var(--chart-2)" },
  cacheWrite: { label: "Cache Write", color: "var(--chart-3)" },
  cacheRead: { label: "Cache Read", color: "var(--chart-4)" },
} satisfies ChartConfig

const PIE_KEYS = ["output", "input", "cacheWrite", "cacheRead"] as const

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function CostBreakdown({ totals }: CostBreakdownProps) {
  if (!totals) return null

  const pieData = PIE_KEYS.map((key) => ({
    key,
    name: chartConfig[key].label,
    value: totals[key],
    fill: `var(--color-${key})`,
  }))

  const totalTokens = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost Breakdown</CardTitle>
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
                          Total Tokens
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
