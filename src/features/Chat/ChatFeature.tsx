import { MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button, ScrollArea, Tabs, TabsList, TabsTrigger } from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import { ConfigBanner } from '@/components/ConfigBanner'
import { cn } from '@/lib/utils'
import { OpenClawChatPanel } from './components/OpenClawChatPanel'
import type { ChatFeatureProps } from './types'
import { classifySessionKey, getSessionSourceBadge } from './utils/sessionKey'

export function ChatFeature(props: ChatFeatureProps) {
  const {
    sessions,
    currentSessionId,
    wsConnected,
    isGatewayRunning,
    configValid,
    showBanner,
    onDismissBanner,
    sessionFilter,
    onSessionFilterChange,
    onCreateSession,
    onSelectSession,
    onDeleteSession,
    onGenerateMetadata,
    sessionMetadata,
    metaBusyByKey,
  } = props

  const { t } = useTranslation('chat')

  return (
    <div className="flex h-full min-h-0">
      {/* Sessions sidebar */}
      <div className="flex min-h-0 w-64 flex-col border-r bg-card">
        <div className="p-4 border-b">
          <Button onClick={onCreateSession} className="w-full" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t('newSession')}
          </Button>
          <div className="mt-3">
            <Tabs value={sessionFilter} onValueChange={(v) => onSessionFilterChange(v as typeof sessionFilter)}>
              <TabsList className="w-full justify-between">
                <TabsTrigger value="ui" className="flex-1 justify-center">
                  {t('sessionFilters.ui')}
                </TabsTrigger>
                <TabsTrigger value="discord" className="flex-1 justify-center">
                  {t('sessionFilters.discord')}
                </TabsTrigger>
                <TabsTrigger value="all" className="flex-1 justify-center">
                  {t('sessionFilters.all')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">{t('noSessions')}</div>
            ) : (
              sessions.map((session) => {
                const { source } = classifySessionKey(session.id)
                const badge = getSessionSourceBadge(source)
                return (
                  <div
                    key={session.id}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer',
                      'hover:bg-accent transition-colors',
                      currentSessionId === session.id && 'bg-accent'
                    )}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{sessionMetadata[session.id]?.title ?? session.name}</div>
                      {sessionMetadata[session.id]?.summary ? (
                        <div className="truncate text-xs text-muted-foreground">{sessionMetadata[session.id]?.summary}</div>
                      ) : null}
                    </div>

                    {badge ? (
                      <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {badge}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void onGenerateMetadata(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-foreground transition-opacity"
                      aria-label={t('generateSessionMetaAria')}
                      disabled={!!metaBusyByKey[session.id]}
                    >
                      <Sparkles className={cn('w-3 h-3', metaBusyByKey[session.id] && 'animate-pulse')} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                      aria-label={t('deleteSessionAria')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Config Banner */}
        {configValid === false && showBanner ? (
          <div className="p-4 pb-0">
            <ConfigBanner onDismiss={onDismissBanner} />
          </div>
        ) : null}

        {currentSessionId ? (
          <OpenClawChatPanel
            key={currentSessionId}
            sessionKey={currentSessionId}
            wsConnected={wsConnected}
            isGatewayRunning={isGatewayRunning}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">{t('createSessionHint')}</div>
        )}
      </div>
    </div>
  )
}

