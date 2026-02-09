import { Card, CardContent } from '@clawui/ui'
import { Coins, Hash, MessageSquare, Timer } from 'lucide-react'
import type { UsageTotals, UsageAggregates } from '@clawui/types/usage'

interface UsageSummaryCardsProps {
  totals: UsageTotals | null
  aggregates: UsageAggregates | null
  sessionCount: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`
}

function formatLatency(ms: number | undefined): string {
  if (ms == null || ms === 0) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

const cards = [
  {
    key: 'tokens',
    label: 'Total Tokens',
    icon: Hash,
    getValue: (t: UsageTotals | null) => (t ? formatTokens(t.totalTokens) : '-'),
    color: 'text-blue-500',
  },
  {
    key: 'cost',
    label: 'Total Cost',
    icon: Coins,
    getValue: (t: UsageTotals | null) => (t ? formatCost(t.totalCost) : '-'),
    color: 'text-amber-500',
  },
  {
    key: 'sessions',
    label: 'Sessions',
    icon: MessageSquare,
    getValue: (_t: UsageTotals | null, count: number) => String(count),
    color: 'text-green-500',
  },
  {
    key: 'latency',
    label: 'Avg Latency',
    icon: Timer,
    getValue: (_t: UsageTotals | null, _c: number, agg: UsageAggregates | null) =>
      formatLatency(agg?.latency?.avgMs),
    color: 'text-purple-500',
  },
] as const

export function UsageSummaryCards({ totals, aggregates, sessionCount }: UsageSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.key}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg bg-muted p-2 ${c.color}`}>
              <c.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-semibold">
                {c.getValue(totals, sessionCount, aggregates)}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
