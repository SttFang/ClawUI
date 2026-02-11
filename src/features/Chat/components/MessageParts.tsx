import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExecActionItem, ExecCompletedSummary, ToolEventCard } from "@/components/A2UI";
import {
  collectCompletedExecTraces,
  isExecPart,
  isExecPreliminary,
} from "@/components/A2UI/execTrace";
import { MessageText } from "./MessageText";

const AUTO_HIDE_DELAY = 1500;
const MS_IN_S = 1000;

function ThinkingIndicator(props: { isStreaming: boolean; duration: number | undefined }) {
  const { t } = useTranslation("common");
  const { isStreaming, duration } = props;

  if (isStreaming || duration === 0) {
    return (
      <div className="text-muted-foreground" aria-label="thinking">
        <span className="claw-text-shimmer">{t("thinking.active")}</span>
      </div>
    );
  }

  const label =
    duration === undefined ? t("thinking.doneShort") : t("thinking.done", { seconds: duration });

  return (
    <div className="text-muted-foreground" aria-label="thinking">
      <span>{label}</span>
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
  const isThinking = streaming && !hasVisibleText;

  // Duration tracking
  const startTimeRef = useRef<number | null>(null);
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(undefined);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (isThinking) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      setShowIndicator(true);
      setThinkingDuration(undefined);
    } else if (startTimeRef.current !== null) {
      const elapsed = Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S);
      setThinkingDuration(elapsed);
      startTimeRef.current = null;
      const timer = setTimeout(() => setShowIndicator(false), AUTO_HIDE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isThinking]);

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
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
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
