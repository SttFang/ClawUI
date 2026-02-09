import { useGatewayStore, selectGatewayStatus } from '@/store/gateway'
import { useChatStore, selectWsConnected } from '@/store/chat'
import { cn } from '@/lib/utils'

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
  const gatewayStatus = useGatewayStore(selectGatewayStatus)
  const wsConnected = useChatStore(selectWsConnected)

  const { color, label } = getStatusDisplay(gatewayStatus, wsConnected)

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
): { color: string; label: string } {
  if (gateway === 'error') {
    return { color: 'bg-red-500', label: 'Error' }
  }
  if (gateway === 'stopped') {
    return { color: 'bg-gray-400', label: 'Offline' }
  }
  if (gateway === 'starting') {
    return { color: 'bg-yellow-500 animate-pulse', label: 'Starting' }
  }
  // gateway === 'running'
  if (wsConnected) {
    return { color: 'bg-green-500', label: 'Connected' }
  }
  return { color: 'bg-orange-400 animate-pulse', label: 'Connecting' }
}
