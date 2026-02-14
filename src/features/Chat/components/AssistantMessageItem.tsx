import type { UIMessage } from "ai";
import { classifyToolRender } from "@/features/Chat/toolRenderPolicy";
import { isLikelyToolReceiptText } from "@/lib/exec/systemTextParsing";
import { MessageParts } from "./MessageParts";

function hasVisibleParts(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "text" && typeof part.text === "string")
      return part.text.trim() !== "" && !isLikelyToolReceiptText(part.text);
    if (part.type === "dynamic-tool") return classifyToolRender(part.toolName).kind !== "hidden";
    return false;
  });
}

export function AssistantMessageItem(props: {
  message: UIMessage;
  sessionKey: string;
  streaming: boolean;
}) {
  const { message, sessionKey, streaming } = props;

  if (!streaming && !hasVisibleParts(message)) return null;

  return (
    <div className="group is-assistant flex w-full justify-center">
      <div className="w-full max-w-[95%] min-w-0 text-sm text-foreground">
        <div className="flex w-full min-w-0 flex-col gap-2 overflow-hidden">
          <MessageParts message={message} streaming={streaming} sessionKey={sessionKey} />
        </div>
      </div>
    </div>
  );
}
