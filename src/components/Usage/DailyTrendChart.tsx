import { useState, useMemo } from 'react'
import { formatTokens, formatLatency } from '@/lib/format'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@clawui/ui/chart'
import { Coins, Hash, MessageSquare, Timer } from 'lucide-react'
import type { CostDailyEntry, UsageTotals, UsageAggregates } from '@clawui/types/usage'

type Granularity = 'hour' | 'day' | 'month'

interface DailyTrendChartProps {
  data: CostDailyEntry[]
  mode: 'tokens' | 'cost'
  totals: UsageTotals | null
  aggregates: UsageAggregates | null
  sessionCount: number
}

const DATA_KEYS = ['output', 'input', 'cacheWrite', 'cacheRead'] as const

function formatDateByGranularity(dateStr: string, granularity: Granularity): string {
  const d = new Date(dateStr)
  switch (granularity) {
    case 'hour':
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:00`
    case 'day':
      return `${d.getMonth() + 1}/${d.getDate()}`
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function formatMonthLabel(key: string, locale: string): string {
  const [y, m] = key.split('-')
  const yearShort = y.slice(2)
  const month = parseInt(m, 10)

  if (locale.toLowerCase().startsWith('zh')) {
    return `${yearShort}年${month}月`
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[month - 1]} ${yearShort}`
}

function formatValue(value: number, mode: 'tokens' | 'cost'): string {
  if (mode === 'cost') return `$${value.toFixed(2)}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}


function aggregateByMonth(
  data: CostDailyEntry[],
  mode: 'tokens' | 'cost',
  locale: string,
): Array<{ date: string; output: number; input: number; cacheWrite: number; cacheRead: number }> {
  const grouped = new Map<string, { output: number; input: number; cacheWrite: number; cacheRead: number }>()

  for (const d of data) {
    const key = getMonthKey(d.date)
    const existing = grouped.get(key) ?? { output: 0, input: 0, cacheWrite: 0, cacheRead: 0 }
    existing.output += mode === 'cost' ? d.outputCost : d.output
    existing.input += mode === 'cost' ? d.inputCost : d.input
    existing.cacheWrite += mode === 'cost' ? d.cacheWriteCost : d.cacheWrite
    existing.cacheRead += mode === 'cost' ? d.cacheReadCost : d.cacheRead
    grouped.set(key, existing)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      date: formatMonthLabel(key, locale),
      ...values,
    }))
}

export function DailyTrendChart({ data, mode, totals, aggregates, sessionCount }: DailyTrendChartProps) {
  const { t, i18n } = useTranslation('common')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const locale = i18n.language

  const chartConfig = useMemo(() => ({
    output: { label: t('usage.metrics.output'), color: "var(--chart-1)" },
    input: { label: t('usage.metrics.input'), color: "var(--chart-2)" },
    cacheWrite: { label: t('usage.metrics.cacheWrite'), color: "var(--chart-3)" },
    cacheRead: { label: t('usage.metrics.cacheRead'), color: "var(--chart-4)" },
  } satisfies ChartConfig), [locale, t])

  const granularityOptions: Array<{ value: Granularity; label: string }> = useMemo(() => [
    { value: 'hour', label: t('usage.granularity.hour') },
    { value: 'day', label: t('usage.granularity.day') },
    { value: 'month', label: t('usage.granularity.month') },
  ], [locale, t])

  const chartData = useMemo(() => {
    if (granularity === 'month') {
      return aggregateByMonth(data, mode, locale)
    }
    return data.map((d) => ({
      date: formatDateByGranularity(d.date, granularity),
      output: mode === 'cost' ? d.outputCost : d.output,
      input: mode === 'cost' ? d.inputCost : d.input,
      cacheWrite: mode === 'cost' ? d.cacheWriteCost : d.cacheWrite,
      cacheRead: mode === 'cost' ? d.cacheReadCost : d.cacheRead,
    }))
  }, [data, mode, granularity, locale])

  const stats = useMemo(() => [
    {
      icon: Hash,
      label: t('usage.trend.tokens'),
      value: totals ? formatTokens(totals.totalTokens) : '-',
      color: 'text-blue-500',
    },
    {
      icon: Coins,
      label: t('usage.trend.cost'),
      value: totals ? `$${totals.totalCost.toFixed(2)}` : '-',
      color: 'text-amber-500',
    },
    {
      icon: MessageSquare,
      label: t('usage.summary.sessions'),
      value: String(sessionCount),
      color: 'text-green-500',
    },
    {
      icon: Timer,
      label: t('usage.trend.latency'),
      value: formatLatency(aggregates?.latency?.avgMs),
      color: 'text-purple-500',
    },
  ], [totals, aggregates, sessionCount, locale, t])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {t('usage.trend.title', { mode: mode === 'cost' ? t('usage.trend.cost') : t('usage.trend.tokens') })}
          </CardTitle>
          <div className="flex items-center gap-1">
            {granularityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                  granularity === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
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
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatValue(v as number, mode)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatValue(Number(value ?? 0), mode)}
                />
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
                radius={key === 'cacheRead' ? [2, 2, 0, 0] : undefined}
              />
            ))}
            {/* Dashed trend lines connecting bars of the same color */}
            {DATA_KEYS.map((key) => (
              <Line
                key={`line-${key}`}
                type="monotone"
                dataKey={key}
                stroke={`var(--color-${key})`}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                legendType="none"
              />
            ))}
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
