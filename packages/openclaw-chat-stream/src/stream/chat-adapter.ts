import type { GatewayEventFrame } from './types'

export type { GatewayEventFrame } from './types'

export type OpenClawChatTransportAdapter = {
  /**
   * Subscribe to raw Gateway events (ACP `type="event"` frames).
   * Must return an unsubscribe function.
   */
  onGatewayEvent: (handler: (event: GatewayEventFrame) => void) => () => void

  /**
   * Best-effort connectivity primitives.
   */
  isConnected?: () => boolean | Promise<boolean>
  connect?: () => void | Promise<void>

  /**
   * Send a WebChat message via OpenClaw Gateway (`chat.send`).
   * Must return the `runId` (typically equals `idempotencyKey`).
   */
  sendChat: (params: { sessionKey: string; message: string }) => Promise<string>

  /**
   * Abort a running WebChat run (`chat.abort`). Optional in v1, but recommended.
   */
  abortChat?: (params: { sessionKey: string; runId?: string }) => Promise<void>

  /** Subscribe to transport-level disconnect. Returns unsubscribe. */
  onDisconnected?: (handler: () => void) => () => void

  /** Subscribe to transport-level reconnect. Returns unsubscribe. */
  onReconnected?: (handler: () => void) => () => void
}

