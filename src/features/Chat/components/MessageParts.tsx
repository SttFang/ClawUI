import type { UIMessage } from "ai";
import { ToolEventCard } from "@/components/A2UI";
import { MessageText } from "./MessageText";

function ThinkingShimmer() {
  return (
    <div className="space-y-2" aria-label="thinking">
      <div className="claw-shimmer h-3 w-40 max-w-full rounded-md" />
      <div className="claw-shimmer h-3 w-56 max-w-full rounded-md" />
      <div className="claw-shimmer h-3 w-32 max-w-full rounded-md" />
    </div>
  );
}

export function MessageParts(props: {
  message: UIMessage;
  streaming: boolean;
  sessionKey: string;
}) {
  const { message, streaming, sessionKey } = props;

  const hasVisibleText = message.parts.some(
    (p) => p.type === "text" && typeof p.text === "string" && Boolean(p.text.trim()),
  );
  const hasVisibleTool = message.parts.some((p) => p.type === "dynamic-tool");
  const shouldShowThinking = streaming && !hasVisibleText && !hasVisibleTool;

  return (
    <div className="space-y-3">
      {shouldShowThinking ? <ThinkingShimmer /> : null}
      {message.parts.map((part, index) => {
        if (part.type === "step-start") return null;
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <MessageText
              key={index}
              text={part.text}
              isAnimating={streaming && part.state === "streaming"}
            />
          );
        }
        if (part.type === "dynamic-tool") {
          return <ToolEventCard key={index} part={part} sessionKey={sessionKey} />;
        }
        // lifecycle 默认不占消息流位置（后续可放到独立的“运行状态/调试”面板）。
        if (part.type === "data-openclaw-lifecycle") return null;
        // v1: ignore other parts (files, reasoning, sources, data parts, static tools).
        return null;
      })}
    </div>
  );
}
