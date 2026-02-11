import type { UIMessage } from "ai";
import { useTranslation } from "react-i18next";
import { ExecActionItem, ExecCompletedSummary, ToolEventCard } from "@/components/A2UI";
import {
  collectCompletedExecTraces,
  isExecPart,
  isExecPreliminary,
} from "@/components/A2UI/execTrace";
import { MessageText } from "./MessageText";

function ThinkingShimmer(props: { label: string }) {
  const { label } = props;
  return (
    <div aria-label="thinking">
      <div className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5">
        <span className="claw-shimmer h-2.5 w-2.5 shrink-0 rounded-full" />
        <span className="text-sm font-semibold tracking-wide text-foreground/85">{label}</span>
      </div>
    </div>
  );
}

export function MessageParts(props: {
  message: UIMessage;
  streaming: boolean;
  sessionKey: string;
}) {
  const { t } = useTranslation("common");
  const { message, streaming, sessionKey } = props;

  const hasVisibleText = message.parts.some(
    (p) => p.type === "text" && typeof p.text === "string" && Boolean(p.text.trim()),
  );
  const shouldShowThinking = streaming && !hasVisibleText;
  const completedExecTraces = collectCompletedExecTraces(message.parts, sessionKey);
  const finishedExecToolCallIds = new Set(
    message.parts.flatMap((p) => {
      if (!isExecPart(p)) return [];
      if (p.state === "output-error") return [p.toolCallId];
      if (p.state === "output-available" && !isExecPreliminary(p)) return [p.toolCallId];
      return [];
    }),
  );

  return (
    <div className="space-y-3">
      {shouldShowThinking ? <ThinkingShimmer label={t("a2ui.execAction.thinking")} /> : null}
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
          if (isExecPart(part)) {
            if (finishedExecToolCallIds.has(part.toolCallId)) {
              // 同一个 exec 已有最终结果时，隐藏历史中的 start/update 片段，避免一直显示“执行中”。
              return null;
            }
            if (
              part.state === "input-available" ||
              part.state === "input-streaming" ||
              (part.state === "output-available" && isExecPreliminary(part))
            ) {
              return <ExecActionItem key={index} part={part} sessionKey={sessionKey} />;
            }
            // exec 完成后主消息区只保留 AI 文本；详情通过摘要入口展开。
            return null;
          }
          return <ToolEventCard key={index} part={part} sessionKey={sessionKey} />;
        }
        // lifecycle 默认不占消息流位置（后续可放到独立的“运行状态/调试”面板）。
        if (part.type === "data-openclaw-lifecycle") return null;
        // v1: ignore other parts (files, reasoning, sources, data parts, static tools).
        return null;
      })}
      {completedExecTraces.length > 0 ? (
        <ExecCompletedSummary traces={completedExecTraces} />
      ) : null}
    </div>
  );
}
