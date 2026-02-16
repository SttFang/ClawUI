import type { UIMessage } from "ai";
import type { RescueMessage } from "@/store/rescue";

export function rescueToUIMessage(msg: RescueMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [
      {
        type: "text" as const,
        text: msg.content,
        ...(msg.isStreaming ? { state: "streaming" as const } : {}),
      },
    ],
  };
}
