import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import type { UsageTotals } from '@clawui/types/usage'

interface CostBreakdownProps {
  totals: UsageTotals | null
}

const COLORS = {
  output: '#ef4444',
  input: '#f59e0b',
  cacheWrite: '#10b981',
  cacheRead: '#06b6d4',
}

export function CostBreakdown({ totals }: CostBreakdownProps) {
  if (!totals) return null

  const data = [
    {
      name: 'Tokens',
      output: totals.output,
      input: totals.input,
      cacheWrite: totals.cacheWrite,
      cacheRead: totals.cacheRead,
    },
    {
      name: 'Cost',
      output: totals.outputCost,
      input: totals.inputCost,
      cacheWrite: totals.cacheWriteCost,
      cacheRead: totals.cacheReadCost,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
            <Bar dataKey="output" fill={COLORS.output} name="Output" stackId="a" />
            <Bar dataKey="input" fill={COLORS.input} name="Input" stackId="a" />
            <Bar dataKey="cacheWrite" fill={COLORS.cacheWrite} name="Cache Write" stackId="a" />
            <Bar dataKey="cacheRead" fill={COLORS.cacheRead} name="Cache Read" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
