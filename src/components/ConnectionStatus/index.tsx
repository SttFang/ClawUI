import { useEffect } from 'react'
import { useGatewayStore, selectGatewayStatus } from '@/store/gateway'
import { useChatStore, selectWsConnected } from '@/store/chat'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { ipc } from '@/lib/ipc'

/**
 * ConnectionStatus — 顶边栏右上角的连接状态指示器
 *
 * 状态优先级：
 *   gateway error  → 红点 "Error"
 *   gateway stopped → 灰点 "Offline"
 *   gateway starting → 黄点闪烁 "Starting"
 *   ws connected    → 绿点 "Connected"
 *   ws disconnected → 橙点 "Connecting"
 */
export function ConnectionStatus() {
  const { t } = useTranslation('common')
  const gatewayStatus = useGatewayStore(selectGatewayStatus)
  const wsConnected = useChatStore(selectWsConnected)
  const setWsConnected = useChatStore((s) => s.setWsConnected)

  // If the main process connected before the renderer subscribed to `chat:connected`,
  // the event can be missed and the UI will get stuck at "Connecting". Sync once.
  useEffect(() => {
    let alive = true
    void ipc.chat
      .isConnected()
      .then((ok) => {
        if (!alive) return
        setWsConnected(ok)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [gatewayStatus, setWsConnected])

  const { color, labelKey } = getStatusDisplay(gatewayStatus, wsConnected)
  const label = t(labelKey)

  return (
    <div
      className="flex items-center gap-1.5 px-3"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className={cn('h-2 w-2 rounded-full', color)} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function getStatusDisplay(
  gateway: string,
  wsConnected: boolean
): { color: string; labelKey: string } {
  if (gateway === 'error') {
    return { color: 'bg-red-500', labelKey: 'connection.error' }
  }
  if (gateway === 'stopped') {
    return { color: 'bg-gray-400', labelKey: 'connection.offline' }
  }
  if (gateway === 'starting') {
    return { color: 'bg-yellow-500 animate-pulse', labelKey: 'connection.starting' }
  }
  // gateway === 'running'
  if (wsConnected) {
    return { color: 'bg-green-500', labelKey: 'connection.connected' }
  }
  return { color: 'bg-orange-400 animate-pulse', labelKey: 'connection.connecting' }
}
