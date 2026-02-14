import type { ChatNormalizedRunEvent } from "@clawui/types";
import type { GatewayEventFrame } from "./chat-websocket";
import { ChatEventAdapter } from "./chat/event-adapter";

export class ChatEventNormalizer {
  private readonly adapter = new ChatEventAdapter();

  onChatSendAccepted(params: {
    sessionKey: string;
    clientRunId: string;
  }): ChatNormalizedRunEvent[] {
    return this.adapter.onChatSendAccepted(params);
  }

  onApprovalResolveRequest(params: {
    approvalId?: string;
    decision?: "allow-once" | "allow-always" | "deny";
    sessionKey?: string;
    commandHint?: string;
    traceId?: string;
    runId?: string;
    toolCallId?: string;
  }): ChatNormalizedRunEvent[] {
    return this.adapter.onApprovalResolveRequest(params);
  }

  ingestGatewayEvent(frame: GatewayEventFrame): ChatNormalizedRunEvent[] {
    return this.adapter.ingestGatewayEvent(frame);
  }

  resetSession(sessionKey: string): void {
    this.adapter.resetSession(sessionKey);
  }

  resetAll(): void {
    this.adapter.resetAll();
  }
}
