import { useMemo, type ComponentType } from 'react'
import { PieChart, Pie, Cell, Label } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@clawui/ui/chart'
import { Anthropic, OpenAI, OpenRouter } from '@lobehub/icons'
import type { SessionModelUsage } from '@clawui/types/usage'

interface ProviderBreakdownProps {
  byProvider: SessionModelUsage[]
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

// Provider icon mapping — matches openclaw onboard providers
const PROVIDER_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  anthropic: Anthropic,
  openai: OpenAI,
  openrouter: OpenRouter,
}

function getProviderIcon(provider: string): ComponentType<{ size?: number }> | null {
  const key = provider.toLowerCase().replace(/[^a-z]/g, '')
  return PROVIDER_ICONS[key] ?? null
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function ProviderBreakdown({ byProvider }: ProviderBreakdownProps) {
  if (!byProvider || byProvider.length === 0) return null

  const { pieData, chartConfig, totalTokens } = useMemo(() => {
    const config: ChartConfig = {}
    const total = byProvider.reduce((s, p) => s + p.totals.totalTokens, 0)
    const data = byProvider.map((p, i) => {
      const key = (p.provider ?? p.model ?? `provider-${i}`).replace(/[^a-zA-Z0-9]/g, '_')
      const color = CHART_COLORS[i % CHART_COLORS.length]
      config[key] = { label: p.provider ?? 'Unknown', color }
      return {
        key,
        name: p.provider ?? 'Unknown',
        value: p.totals.totalTokens,
        fill: `var(--color-${key})`,
      }
    })
    return { pieData: data, chartConfig: config, totalTokens: total }
  }, [byProvider])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Provider Distribution</CardTitle>
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
                          {byProvider.length}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          Providers
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        {/* Provider legend with icons */}
        <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {pieData.map((entry, i) => {
            const Icon = getProviderIcon(entry.name)
            const pct = totalTokens > 0 ? ((entry.value / totalTokens) * 100).toFixed(0) : '0'
            return (
              <div key={entry.key} className="flex items-center gap-1.5 text-sm">
                {Icon ? (
                  <Icon size={16} />
                ) : (
                  <div
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                )}
                <span>{entry.name}</span>
                <span className="text-muted-foreground">({pct}%)</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
