import type { ChatTransport, UIMessage } from 'ai'

import { createOpenClawChatStream } from './stream/chat-stream'
import type { OpenClawChatTransportAdapter } from './stream/chat-adapter'
import type { StreamLogger } from './stream/logger'

export type { GatewayEventFrame } from './stream/types'
export type { OpenClawChatTransportAdapter } from './stream/chat-adapter'

export function createOpenClawChatTransport(params: {
  sessionKey: string
  adapter: OpenClawChatTransportAdapter
  logger?: StreamLogger
}): ChatTransport<UIMessage> {
  const { sessionKey, adapter, logger } = params

  return {
    async sendMessages({ messages, abortSignal, trigger }) {
      return createOpenClawChatStream({
        sessionKey,
        adapter,
        messages,
        abortSignal,
        trigger,
        logger,
      })
    },

    async reconnectToStream() {
      return null
    },
  }
}

