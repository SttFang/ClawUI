import { Card, CardContent } from '@clawui/ui'
import { Coins, Hash, MessageSquare, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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

export function UsageSummaryCards({ totals, aggregates, sessionCount }: UsageSummaryCardsProps) {
  const { t, i18n } = useTranslation('common')
  const cards = useMemo(() => [
    {
      key: 'tokens',
      label: t('usage.summary.totalTokens'),
      icon: Hash,
      getValue: (totals: UsageTotals | null) => (totals ? formatTokens(totals.totalTokens) : '-'),
      color: 'text-blue-500',
    },
    {
      key: 'cost',
      label: t('usage.summary.totalCost'),
      icon: Coins,
      getValue: (totals: UsageTotals | null) => (totals ? formatCost(totals.totalCost) : '-'),
      color: 'text-amber-500',
    },
    {
      key: 'sessions',
      label: t('usage.summary.sessions'),
      icon: MessageSquare,
      getValue: (_t: UsageTotals | null, count: number) => String(count),
      color: 'text-green-500',
    },
    {
      key: 'latency',
      label: t('usage.summary.avgLatency'),
      icon: Timer,
      getValue: (_t: UsageTotals | null, _c: number, agg: UsageAggregates | null) =>
        formatLatency(agg?.latency?.avgMs),
      color: 'text-purple-500',
    },
  ] as const, [i18n.language, t])

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
