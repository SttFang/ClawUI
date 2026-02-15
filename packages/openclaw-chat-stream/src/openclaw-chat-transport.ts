import type { ChatTransport, UIMessage } from 'ai'

import { createOpenClawChatStream } from './openclaw/chat-stream'
import type { OpenClawChatTransportAdapter } from './openclaw/chat-adapter'

export type { GatewayEventFrame } from './openclaw/types'
export type { OpenClawChatTransportAdapter } from './openclaw/chat-adapter'

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

