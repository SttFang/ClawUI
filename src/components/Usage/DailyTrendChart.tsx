import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import type { CostDailyEntry } from '@clawui/types/usage'

interface DailyTrendChartProps {
  data: CostDailyEntry[]
  mode: 'tokens' | 'cost'
}

const COLORS = {
  output: '#ef4444',
  input: '#f59e0b',
  cacheWrite: '#10b981',
  cacheRead: '#06b6d4',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatValue(value: number, mode: 'tokens' | 'cost'): string {
  if (mode === 'cost') return `$${value.toFixed(2)}`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function DailyTrendChart({ data, mode }: DailyTrendChartProps) {
  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    output: mode === 'cost' ? d.outputCost : d.output,
    input: mode === 'cost' ? d.inputCost : d.input,
    cacheWrite: mode === 'cost' ? d.cacheWriteCost : d.cacheWrite,
    cacheRead: mode === 'cost' ? d.cacheReadCost : d.cacheRead,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Daily Trend ({mode === 'cost' ? 'Cost' : 'Tokens'})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {Object.entries(COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
            <YAxis
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatValue(v as number, mode)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
              }}
              formatter={(value) => formatValue(Number(value ?? 0), mode)}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: '0.75rem' }} />
            <Area
              type="monotone"
              dataKey="output"
              stackId="1"
              stroke={COLORS.output}
              fill="url(#grad-output)"
              name="Output"
            />
            <Area
              type="monotone"
              dataKey="input"
              stackId="1"
              stroke={COLORS.input}
              fill="url(#grad-input)"
              name="Input"
            />
            <Area
              type="monotone"
              dataKey="cacheWrite"
              stackId="1"
              stroke={COLORS.cacheWrite}
              fill="url(#grad-cacheWrite)"
              name="Cache Write"
            />
            <Area
              type="monotone"
              dataKey="cacheRead"
              stackId="1"
              stroke={COLORS.cacheRead}
              fill="url(#grad-cacheRead)"
              name="Cache Read"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
