import type { UIMessage } from "ai";
import { MessageParts } from "./MessageParts";

export function UserMessageItem(props: { message: UIMessage; sessionKey: string }) {
  const { message, sessionKey } = props;

  const hasVisibleContent = message.parts.some((part) => {
    if (part.type === "text") return typeof part.text === "string" && part.text.trim() !== "";
    return true; // non-text parts (dynamic-tool, image, etc.) are visible
  });
  if (!hasVisibleContent) return null;

  return (
    <div className="group is-user ml-auto flex w-full max-w-[95%] flex-col justify-end gap-2">
      <div className="ml-auto flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg bg-secondary px-4 py-3 text-sm text-foreground">
        <MessageParts message={message} streaming={false} sessionKey={sessionKey} />
      </div>
    </div>
  );
}
