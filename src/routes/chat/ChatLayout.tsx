import { useEffect, useMemo, useState } from 'react'
import type { ClawUISessionMetadata } from '@clawui/types/clawui'
import { useChatStore, selectCurrentSession, selectSessions } from '@/store/chat'
import { useGatewayStore, selectIsGatewayRunning } from '@/store/gateway'
import { ipc } from '@/lib/ipc'
import { ChatFeature, matchesSessionFilter, classifySessionKey, type SessionFilter, type SessionListItem } from '@/features/Chat'

export default function ChatLayout() {
  const sessions = useChatStore(selectSessions)
  const currentSession = useChatStore(selectCurrentSession)
  const wsConnected = useChatStore((s) => s.wsConnected)
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning)

  const createSession = useChatStore((s) => s.createSession)
  const refreshSessions = useChatStore((s) => s.refreshSessions)
  const selectSession = useChatStore((s) => s.selectSession)
  const deleteSession = useChatStore((s) => s.deleteSession)

  const [configValid, setConfigValid] = useState<boolean | null>(null)
  const [showBanner, setShowBanner] = useState(true)
  const [didLoadSessions, setDidLoadSessions] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('ui')
  const [sessionMetadata, setSessionMetadata] = useState<Record<string, ClawUISessionMetadata>>({})
  const [metaBusyByKey, setMetaBusyByKey] = useState<Record<string, boolean>>({})

  const visibleSessions: SessionListItem[] = useMemo(() => {
    return sessions
      .filter((s) => {
        const { source, hidden } = classifySessionKey(s.id)
        if (hidden) return false
        return matchesSessionFilter(source, sessionFilter)
      })
      .map((s) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt }))
  }, [sessions, sessionFilter])

  useEffect(() => {
    // If the current session is hidden by the filter, select the newest visible one.
    const currentId = currentSession?.id
    if (!currentId) return
    if (visibleSessions.some((s) => s.id === currentId)) return
    const fallback = visibleSessions[0]?.id
    if (fallback) selectSession(fallback)
  }, [currentSession?.id, visibleSessions, selectSession])

  useEffect(() => {
    void refreshSessions().finally(() => setDidLoadSessions(true))
  }, [refreshSessions])

  useEffect(() => {
    if (!didLoadSessions) return
    if (sessions.length > 0) return
    createSession()
  }, [didLoadSessions, sessions.length, createSession])

  useEffect(() => {
    async function checkConfig() {
      try {
        const status = await ipc.onboarding.detect()
        setConfigValid(status?.configValid ?? false)
      } catch {
        setConfigValid(false)
      }
    }
    void checkConfig()
  }, [])

  useEffect(() => {
    ipc.state
      .get()
      .then((state) => setSessionMetadata(state.sessions?.metadata ?? {}))
      .catch(() => {})
  }, [])

  const generateMetadata = async (key: string) => {
    setMetaBusyByKey((m) => ({ ...m, [key]: true }))
    try {
      const meta = await ipc.metadata.generate(key)
      setSessionMetadata((prev) => ({ ...prev, [key]: meta }))
    } finally {
      setMetaBusyByKey((m) => ({ ...m, [key]: false }))
    }
  }

  return (
    <ChatFeature
      sessions={visibleSessions}
      currentSessionId={currentSession?.id ?? null}
      wsConnected={wsConnected}
      isGatewayRunning={isGatewayRunning}
      configValid={configValid}
      showBanner={showBanner}
      onDismissBanner={() => setShowBanner(false)}
      sessionFilter={sessionFilter}
      onSessionFilterChange={setSessionFilter}
      onCreateSession={() => void createSession()}
      onSelectSession={(id) => selectSession(id)}
      onDeleteSession={(id) => deleteSession(id)}
      onGenerateMetadata={(id) => void generateMetadata(id)}
      sessionMetadata={sessionMetadata}
      metaBusyByKey={metaBusyByKey}
    />
  )
}

