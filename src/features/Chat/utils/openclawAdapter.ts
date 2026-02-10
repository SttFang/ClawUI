import type { OpenClawChatTransportAdapter } from '@clawui/claw-sse'
import { ipc } from '@/lib/ipc'

export function createRendererOpenClawAdapter(): OpenClawChatTransportAdapter {
  let connectPromise: Promise<void> | null = null

  return {
    onGatewayEvent: (handler) => ipc.gateway.onEvent(handler),
    isConnected: () => ipc.chat.isConnected(),
    connect: async () => {
      if (connectPromise) return connectPromise
      connectPromise = (async () => {
        const ok = await ipc.chat.connect()
        if (!ok) throw new Error('Failed to connect gateway WebSocket')
      })().finally(() => {
        connectPromise = null
      })
      return connectPromise
    },
    sendChat: async ({ sessionKey, message }) => {
      return ipc.chat.send({ sessionId: sessionKey, message })
    },
    abortChat: async ({ sessionKey, runId }) => {
      await ipc.chat.request('chat.abort', { sessionKey, runId })
    },
  }
}

