import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolEventCard } from "@/components/A2UI";
import { classifyToolRender } from "@/features/Chat/toolRenderPolicy";
import { isExecToolName, normalizeToolCallId } from "@/lib/exec";
import { isLikelyToolReceiptText } from "@/lib/exec/systemTextParsing";
import { useExecToolRenderItems } from "./hooks/useExecToolRenderItems";
import { MessageText } from "./MessageText";

const AUTO_HIDE_DELAY = 1500;
const MS_IN_S = 1000;

type RenderableItem =
  | {
      kind: "text";
      key: string;
      node: ReactElement;
    }
  | {
      kind: "tool";
      key: string;
      node: ReactElement;
      toolCallId: string;
    };

type TextPartLike = {
  type: "text";
  text: string;
  state?: "streaming";
};

function isTextPartLike(part: unknown): part is TextPartLike {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  return record.type === "text" && typeof record.text === "string";
}

function isDynamicToolPartLike(part: unknown): part is DynamicToolUIPart {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  return (
    record.type === "dynamic-tool" &&
    typeof record.toolCallId === "string" &&
    typeof record.toolName === "string"
  );
}

function aggregateRenderableItems(items: (RenderableItem | null)[]): RenderableItem[] {
  const toolIndexById = new Map<string, number>();
  const result: RenderableItem[] = [];

  for (const item of items) {
    if (!item) continue;
    if (item.kind === "tool") {
      const idx = toolIndexById.get(item.toolCallId);
      if (idx !== undefined) {
        result[idx] = item;
        continue;
      }
      toolIndexById.set(item.toolCallId, result.length);
      result.push(item);
      continue;
    }
    result.push(item);
  }

  return result;
}

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
  const execItemsByIndex = useExecToolRenderItems({ message, sessionKey });

  const hasVisibleText = message.parts.some(
    (part) => part.type === "text" && typeof part.text === "string" && Boolean(part.text.trim()),
  );
  const isThinking = streaming && !hasVisibleText;

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
    return undefined;
  }, [isThinking]);

  const nodes = useMemo(() => {
    const nextItems: (RenderableItem | null)[] = Array.from(
      { length: message.parts.length },
      () => null,
    );

    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];

      if (isTextPartLike(part)) {
        if (!part.text.trim()) continue;
        if (message.role !== "user" && isLikelyToolReceiptText(part.text)) continue;
        nextItems[index] = {
          kind: "text",
          key: `text:${index}`,
          node: (
            <MessageText
              key={`text:${index}`}
              text={part.text}
              isAnimating={streaming && part.state === "streaming"}
            />
          ),
        };
        continue;
      }

      if (!isDynamicToolPartLike(part)) continue;
      const policy = classifyToolRender(part.toolName);
      if (policy.kind === "hidden") continue;

      if (policy.kind === "exec_card" && isExecToolName(part.toolName)) {
        const execItem = execItemsByIndex[index];
        if (!execItem) continue;
        nextItems[index] = {
          kind: "tool",
          key: `exec:${execItem.attemptId}:${index}`,
          toolCallId: execItem.attemptId,
          node: execItem.node,
        };
        continue;
      }

      const stableToolCallId = normalizeToolCallId(part.toolCallId);
      const normalizedPart =
        stableToolCallId && stableToolCallId !== part.toolCallId
          ? ({ ...part, toolCallId: stableToolCallId } as DynamicToolUIPart)
          : part;
      nextItems[index] = {
        kind: "tool",
        key: `tool:${stableToolCallId || part.toolCallId}:${index}`,
        toolCallId: stableToolCallId || part.toolCallId,
        node: (
          <ToolEventCard
            key={`tool:${stableToolCallId || part.toolCallId}:${index}`}
            part={normalizedPart}
            sessionKey={sessionKey}
            renderMode={policy.kind === "read_compact" ? "read_compact" : "generic"}
            maxPreviewChars={policy.maxPreviewChars}
          />
        ),
      };
    }

    return aggregateRenderableItems(nextItems).map((item) => item.node);
  }, [execItemsByIndex, message.parts, sessionKey, streaming]);

  return (
    <div className="space-y-3">
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
      {nodes}
    </div>
  );
}
