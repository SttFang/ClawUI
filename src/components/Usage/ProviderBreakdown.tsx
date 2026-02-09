import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import type { SessionModelUsage } from '@clawui/types/usage'

interface ProviderBreakdownProps {
  byProvider: SessionModelUsage[]
}

const PROVIDER_COLORS = [
  'bg-blue-500',
  'bg-amber-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
]

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function ProviderBreakdown({ byProvider }: ProviderBreakdownProps) {
  if (!byProvider || byProvider.length === 0) return null

  const totalTokens = byProvider.reduce((s, p) => s + p.totals.totalTokens, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Provider Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {byProvider.map((p, i) => {
          const pct = totalTokens > 0 ? (p.totals.totalTokens / totalTokens) * 100 : 0
          const color = PROVIDER_COLORS[i % PROVIDER_COLORS.length]
          return (
            <div key={p.provider ?? p.model ?? i}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
                  <span>{p.provider ?? 'Unknown'}</span>
                </div>
                <span className="text-muted-foreground">
                  {formatTokens(p.totals.totalTokens)} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
