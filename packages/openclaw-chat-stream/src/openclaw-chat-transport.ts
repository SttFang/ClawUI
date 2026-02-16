import type { ChatTransport, UIMessage } from 'ai'

import { createOpenClawChatStream } from './stream/chat-stream'
import type { OpenClawChatTransportAdapter } from './stream/chat-adapter'

export type { GatewayEventFrame } from './stream/types'
export type { OpenClawChatTransportAdapter } from './stream/chat-adapter'

export function createOpenClawChatTransport(params: {
  sessionKey: string
  adapter: OpenClawChatTransportAdapter
}): ChatTransport<UIMessage> {
  const { sessionKey, adapter } = params

  return {
    async sendMessages({ messages, abortSignal, trigger }) {
      return createOpenClawChatStream({
        sessionKey,
        adapter,
        messages,
        abortSignal,
        trigger,
      })
    },

    async reconnectToStream() {
      return null
    },
  }
}

