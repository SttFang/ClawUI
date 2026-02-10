import { useMemo, type ComponentType } from 'react'
import { PieChart, Pie, Cell, Label } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@clawui/ui/chart'
import { Anthropic, OpenAI, OpenRouter } from '@lobehub/icons'
import type { SessionModelUsage } from '@clawui/types/usage'
import { formatTokens } from '@/lib/format'

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

export function ProviderBreakdown({ byProvider }: ProviderBreakdownProps) {
  const { t, i18n } = useTranslation('common')

  if (!byProvider || byProvider.length === 0) return null

  const { pieData, chartConfig, totalTokens } = useMemo(() => {
    const config: ChartConfig = {}
    const total = byProvider.reduce((s, p) => s + p.totals.totalTokens, 0)
    const data = byProvider.map((p, i) => {
      const key = (p.provider ?? p.model ?? `provider-${i}`).replace(/[^a-zA-Z0-9]/g, '_')
      const color = CHART_COLORS[i % CHART_COLORS.length]
      config[key] = { label: p.provider ?? t('usage.providerBreakdown.unknown'), color }
      return {
        key,
        name: p.provider ?? t('usage.providerBreakdown.unknown'),
        value: p.totals.totalTokens,
        fill: `var(--color-${key})`,
      }
    })
    return { pieData: data, chartConfig: config, totalTokens: total }
  }, [byProvider, i18n.language, t])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('usage.providerBreakdown.title')}</CardTitle>
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
                          {t('usage.providerBreakdown.centerLabel')}
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
