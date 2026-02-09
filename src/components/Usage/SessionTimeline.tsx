import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { Loader2 } from 'lucide-react'
import type { UsageTimeSeries } from '@clawui/types/usage'

interface SessionTimelineProps {
  timeSeries: UsageTimeSeries | null
  loading: boolean
  mode: 'tokens' | 'cost'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const COLORS = {
  output: '#ef4444',
  input: '#f59e0b',
  cacheRead: '#06b6d4',
  cumulative: '#8b5cf6',
}

export function SessionTimeline({ timeSeries, loading, mode }: SessionTimelineProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!timeSeries || timeSeries.points.length === 0) return null

  const chartData = timeSeries.points.map((p) => ({
    time: formatTime(p.timestamp),
    output: mode === 'cost' ? p.cost : p.output,
    input: mode === 'cost' ? 0 : p.input,
    cacheRead: mode === 'cost' ? 0 : p.cacheRead,
    cumulative: mode === 'cost' ? p.cumulativeCost : p.cumulativeTokens,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Session Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
              }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: '0.75rem' }} />
            {mode === 'tokens' && (
              <>
                <Line
                  type="monotone"
                  dataKey="output"
                  stroke={COLORS.output}
                  strokeWidth={1.5}
                  dot={false}
                  name="Output"
                />
                <Line
                  type="monotone"
                  dataKey="input"
                  stroke={COLORS.input}
                  strokeWidth={1.5}
                  dot={false}
                  name="Input"
                />
                <Line
                  type="monotone"
                  dataKey="cacheRead"
                  stroke={COLORS.cacheRead}
                  strokeWidth={1.5}
                  dot={false}
                  name="Cache Read"
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={COLORS.cumulative}
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 3"
              name={mode === 'cost' ? 'Cumulative Cost' : 'Cumulative Tokens'}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
