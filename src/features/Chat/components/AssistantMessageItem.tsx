import type { UIMessage } from "ai";
import { MessageParts } from "./MessageParts";

export function AssistantMessageItem(props: {
  message: UIMessage;
  sessionKey: string;
  streaming: boolean;
}) {
  const { message, sessionKey, streaming } = props;
  return (
    <div className="flex justify-start gap-3">
      <div className="mr-auto min-w-0 max-w-[85%] text-left sm:max-w-[75%]">
        <div className="space-y-3">
          <div className="inline-block max-w-full rounded-xl bg-transparent px-4 py-3">
            <MessageParts message={message} streaming={streaming} sessionKey={sessionKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
