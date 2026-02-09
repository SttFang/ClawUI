import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { MessageSquare, Wrench, AlertCircle, Clock } from 'lucide-react'
import type { SessionsUsageEntry } from '@clawui/types/usage'

interface SessionDetailProps {
  session: SessionsUsageEntry | undefined
}

function formatDuration(ms: number | undefined): string {
  if (ms == null) return '-'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return `${min}m ${remSec}s`
}

export function SessionDetail({ session }: SessionDetailProps) {
  if (!session?.usage) return null

  const { usage } = session
  const stats = [
    {
      icon: MessageSquare,
      label: 'Messages',
      value: usage.messageCounts?.total ?? '-',
      sub: usage.messageCounts
        ? `User: ${usage.messageCounts.user} / Asst: ${usage.messageCounts.assistant}`
        : undefined,
    },
    {
      icon: Wrench,
      label: 'Tool Calls',
      value: usage.toolUsage?.totalCalls ?? '-',
      sub: usage.toolUsage
        ? `${usage.toolUsage.uniqueTools} unique tools`
        : undefined,
    },
    {
      icon: AlertCircle,
      label: 'Errors',
      value: usage.messageCounts?.errors ?? 0,
    },
    {
      icon: Clock,
      label: 'Duration',
      value: formatDuration(usage.durationMs),
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {session.label ?? session.key}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex items-start gap-2">
              <s.icon size={14} className="mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-medium">{s.value}</p>
                {s.sub && (
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Model usage breakdown */}
        {usage.modelUsage && usage.modelUsage.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Models Used</p>
            <div className="space-y-1">
              {usage.modelUsage.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{m.model ?? 'unknown'}</span>
                  <span className="text-muted-foreground">
                    {m.count} calls / ${m.totals.totalCost.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top tools */}
        {usage.toolUsage && usage.toolUsage.tools.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Top Tools</p>
            <div className="flex flex-wrap gap-1">
              {usage.toolUsage.tools.slice(0, 8).map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                >
                  {t.name}
                  <span className="text-muted-foreground">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
