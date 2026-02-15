import type { OpenClawChatTransportAdapter } from "@clawui/openclaw-chat-stream";
import { ipc } from "@/lib/ipc";
import { ensureChatConnected } from "@/services/chat/connection";

export function createRendererOpenClawAdapter(): OpenClawChatTransportAdapter {
  return {
    onGatewayEvent: (handler) => ipc.gateway.onEvent(handler),
    isConnected: () => ipc.chat.isConnected(),
    connect: async () => {
      await ensureChatConnected();
    },
    sendChat: async ({ sessionKey, message }) => {
      return ipc.chat.send({ sessionId: sessionKey, message });
    },
    abortChat: async ({ sessionKey, runId }) => {
      await ipc.chat.request("chat.abort", { sessionKey, runId });
    },
  };
}
