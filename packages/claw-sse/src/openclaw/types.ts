export type GatewayEventFrame = {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

export type OpenClawChatEvent = {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
  usage?: unknown
  stopReason?: string
}

export type OpenClawAgentEventPayload = {
  runId: string
  seq: number
  stream: string
  ts: number
  data: Record<string, unknown>
  sessionKey?: string
}

export type OpenClawToolEventData = {
  phase: 'start' | 'update' | 'result'
  name: string
  toolCallId: string
  args?: unknown
  partialResult?: unknown
  result?: unknown
  meta?: unknown
  isError?: unknown
}

export type OpenClawLifecycleEventData = {
  phase?: unknown
  error?: unknown
}

