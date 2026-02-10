import { Card, CardContent, CardHeader, CardTitle } from '@clawui/ui'
import { MessageSquare, Wrench, AlertCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('common')

  if (!session?.usage) return null
  const { usage } = session
  const stats = [
    {
      icon: MessageSquare,
      label: t('usage.sessionDetail.messages'),
      value: usage.messageCounts?.total ?? '-',
      sub: usage.messageCounts
        ? t('usage.sessionDetail.messageSub', {
            user: usage.messageCounts.user,
            assistant: usage.messageCounts.assistant,
          })
        : undefined,
    },
    {
      icon: Wrench,
      label: t('usage.sessionDetail.toolCalls'),
      value: usage.toolUsage?.totalCalls ?? '-',
      sub: usage.toolUsage
        ? t('usage.sessionDetail.toolSub', { n: usage.toolUsage.uniqueTools })
        : undefined,
    },
    {
      icon: AlertCircle,
      label: t('usage.sessionDetail.errors'),
      value: usage.messageCounts?.errors ?? 0,
    },
    {
      icon: Clock,
      label: t('usage.sessionDetail.duration'),
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
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('usage.sessionDetail.modelsUsed')}</p>
            <div className="space-y-1">
              {usage.modelUsage.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span>{m.model ?? t('usage.sessionDetail.modelUnknown')}</span>
                  <span className="text-muted-foreground">
                    {t('usage.sessionDetail.modelCallsCost', { n: m.count, cost: m.totals.totalCost.toFixed(4) })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top tools */}
        {usage.toolUsage && usage.toolUsage.tools.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('usage.sessionDetail.topTools')}</p>
            <div className="flex flex-wrap gap-1">
              {usage.toolUsage.tools.slice(0, 8).map((tool) => (
                <span
                  key={tool.name}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                >
                  {tool.name}
                  <span className="text-muted-foreground">{tool.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
