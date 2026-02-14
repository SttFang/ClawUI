import type { UIMessage } from "ai";
import { isLikelyToolReceiptText } from "@/lib/exec/systemTextParsing";
import { MessageParts } from "./MessageParts";

export function SystemMessageItem(props: { message: UIMessage; sessionKey: string }) {
  const { message, sessionKey } = props;

  const hasVisibleContent = message.parts.some((part) => {
    if (part.type === "text" && typeof part.text === "string")
      return part.text.trim() !== "" && !isLikelyToolReceiptText(part.text);
    return part.type === "dynamic-tool";
  });
  if (!hasVisibleContent) return null;

  return (
    <div className="group is-system flex w-full justify-center">
      <div className="w-full max-w-[95%] min-w-0 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <MessageParts message={message} streaming={false} sessionKey={sessionKey} />
      </div>
    </div>
  );
}
