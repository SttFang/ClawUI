import type { UIMessage } from "ai";
import { MessageParts } from "./MessageParts";

export function AssistantMessageItem(props: {
  message: UIMessage;
  sessionKey: string;
  streaming: boolean;
}) {
  const { message, sessionKey, streaming } = props;
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
