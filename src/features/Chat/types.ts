import type { UIMessage } from 'ai'
import type { ClawUISessionMetadata } from '@clawui/types/clawui'

export type SessionSource =
  | 'ui'
  | 'discord'
  | 'telegram'
  | 'slack'
  | 'whatsapp'
  | 'wechat'
  | 'signal'
  | 'cron'
  | 'unknown'

export type SessionFilter = 'ui' | 'discord' | 'channels' | 'all'

export type SessionListItem = {
  id: string
  name: string
  updatedAt: number
  surface?: string | null
}

export type ChatFeatureProps = {
  sessions: SessionListItem[]
  currentSessionId: string | null
  wsConnected: boolean
  isGatewayRunning: boolean

  configValid: boolean | null
  showBanner: boolean
  onDismissBanner: () => void
  onOneClickConfig: () => void
  onManualConfig: () => void

  sessionFilter: SessionFilter
  onSessionFilterChange: (filter: SessionFilter) => void
  onCreateSession: () => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onGenerateMetadata: (id: string) => void

  sessionMetadata: Record<string, ClawUISessionMetadata>
  metaBusyByKey: Record<string, boolean>
}

export type MessagePartsProps = { message: UIMessage; streaming: boolean }
