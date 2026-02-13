import type { UIMessage } from "ai";
import { MessageParts } from "./MessageParts";

export function UserMessageItem(props: { message: UIMessage; sessionKey: string }) {
  const { message, sessionKey } = props;
  return (
    <div className="flex justify-end gap-3">
      <div className="ml-auto min-w-0 max-w-[85%] text-right sm:max-w-[75%]">
        <div className="inline-block max-w-full rounded-xl border border-primary/30 bg-primary/95 px-4 py-3 text-primary-foreground">
          <MessageParts message={message} streaming={false} sessionKey={sessionKey} />
        </div>
      </div>
    </div>
  );
}
