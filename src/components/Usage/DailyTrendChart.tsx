import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
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

const chartConfig = {
  output: { label: "Output", color: "var(--chart-1)" },
  input: { label: "Input", color: "var(--chart-2)" },
  cacheWrite: { label: "Cache Write", color: "var(--chart-3)" },
  cacheRead: { label: "Cache Read", color: "var(--chart-4)" },
} satisfies ChartConfig

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'hour', label: '小时' },
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
]

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
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

function formatValue(value: number, mode: 'tokens' | 'cost'): string {
  if (mode === 'cost') return `$${value.toFixed(2)}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatLatency(ms: number | undefined): string {
  if (ms == null || ms === 0) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function aggregateByMonth(
  data: CostDailyEntry[],
  mode: 'tokens' | 'cost',
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
      date: formatMonthLabel(key),
      ...values,
    }))
}

export function DailyTrendChart({ data, mode, totals, aggregates, sessionCount }: DailyTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('day')

  const chartData = useMemo(() => {
    if (granularity === 'month') {
      return aggregateByMonth(data, mode)
    }
    // hour and day use the same daily data (hourly data not available from backend)
    return data.map((d) => ({
      date: formatDateByGranularity(d.date, granularity),
      output: mode === 'cost' ? d.outputCost : d.output,
      input: mode === 'cost' ? d.inputCost : d.input,
      cacheWrite: mode === 'cost' ? d.cacheWriteCost : d.cacheWrite,
      cacheRead: mode === 'cost' ? d.cacheReadCost : d.cacheRead,
    }))
  }, [data, mode, granularity])

  const stats = useMemo(() => [
    {
      icon: Hash,
      label: 'Tokens',
      value: totals ? formatTokens(totals.totalTokens) : '-',
      color: 'text-blue-500',
    },
    {
      icon: Coins,
      label: 'Cost',
      value: totals ? `$${totals.totalCost.toFixed(2)}` : '-',
      color: 'text-amber-500',
    },
    {
      icon: MessageSquare,
      label: 'Sessions',
      value: String(sessionCount),
      color: 'text-green-500',
    },
    {
      icon: Timer,
      label: 'Latency',
      value: formatLatency(aggregates?.latency?.avgMs),
      color: 'text-purple-500',
    },
  ], [totals, aggregates, sessionCount])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">
            Trend ({mode === 'cost' ? 'Cost' : 'Tokens'})
          </CardTitle>
          {/* Granularity toggle */}
          <div className="flex items-center gap-1">
            {GRANULARITY_OPTIONS.map((opt) => (
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
        {/* Inline metadata stats */}
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
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {Object.keys(chartConfig).map((key) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
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
            <Area
              type="monotone"
              dataKey="output"
              stackId="1"
              stroke="var(--color-output)"
              fill="url(#grad-output)"
            />
            <Area
              type="monotone"
              dataKey="input"
              stackId="1"
              stroke="var(--color-input)"
              fill="url(#grad-input)"
            />
            <Area
              type="monotone"
              dataKey="cacheWrite"
              stackId="1"
              stroke="var(--color-cacheWrite)"
              fill="url(#grad-cacheWrite)"
            />
            <Area
              type="monotone"
              dataKey="cacheRead"
              stackId="1"
              stroke="var(--color-cacheRead)"
              fill="url(#grad-cacheRead)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
