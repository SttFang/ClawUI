import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExecTool, ExecGroup, ToolGroup, SubagentTool } from "@/features/Chat/components/A2UI";
import {
  deduplicateToolParts,
  normalizeMessageParts,
} from "@/features/Chat/lib/normalizeMessageParts";
import { classifyToolRender } from "@/features/Chat/toolRenderPolicy";
import { isExecToolName } from "@/lib/exec";
import { MessageText } from "./MessageText";
import { ReasoningContent } from "./ReasoningContent";

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
      meta?: { renderKind: "explore" | "exec" | "subagent"; part: DynamicToolUIPart };
    };

type TextPartLike = {
  type: "text";
  text: string;
  state?: "streaming";
};

type ReasoningPartLike = {
  type: "reasoning";
  reasoning: string;
  state?: "streaming";
};

function isTextPartLike(part: unknown): part is TextPartLike {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  return record.type === "text" && typeof record.text === "string";
}

function isReasoningPartLike(part: unknown): part is ReasoningPartLike {
  if (!part || typeof part !== "object") return false;
  const record = part as Record<string, unknown>;
  return record.type === "reasoning" && typeof record.reasoning === "string";
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

function groupExploreTools(items: RenderableItem[]): RenderableItem[] {
  const exploreParts: DynamicToolUIPart[] = [];
  let firstExploreIndex = -1;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === "tool" && item.meta?.renderKind === "explore") {
      exploreParts.push(item.meta.part);
      if (firstExploreIndex === -1) firstExploreIndex = i;
    }
  }

  if (!exploreParts.length) return items;

  const deduped = deduplicateToolParts(exploreParts);

  const result: RenderableItem[] = [];
  let groupInserted = false;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === "tool" && item.meta?.renderKind === "explore") {
      if (!groupInserted) {
        const key = `explore-group:${firstExploreIndex}`;
        result.push({
          kind: "tool",
          key,
          toolCallId: key,
          node: <ToolGroup key={key} parts={deduped} />,
        });
        groupInserted = true;
      }
      continue;
    }
    result.push(item);
  }

  return result;
}

function groupExecTools(items: RenderableItem[], sessionKey: string): RenderableItem[] {
  const execParts: DynamicToolUIPart[] = [];
  let firstExecIndex = -1;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === "tool" && item.meta?.renderKind === "exec") {
      execParts.push(item.meta.part);
      if (firstExecIndex === -1) firstExecIndex = i;
    }
  }

  if (execParts.length < 2) return items;

  const result: RenderableItem[] = [];
  let groupInserted = false;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === "tool" && item.meta?.renderKind === "exec") {
      if (!groupInserted) {
        const key = `exec-group:${firstExecIndex}`;
        result.push({
          kind: "tool",
          key,
          toolCallId: key,
          node: <ExecGroup key={key} parts={execParts} sessionKey={sessionKey} />,
        });
        groupInserted = true;
      }
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
  const { t } = useTranslation("common");

  const normalizedParts = useMemo(
    () => normalizeMessageParts(message.parts, { streaming }),
    [message.parts, streaming],
  );

  const hasVisibleText = normalizedParts.some(
    (part) => part.type === "text" && typeof part.text === "string" && Boolean(part.text.trim()),
  );
  const hasVisibleTools = normalizedParts.some(
    (part) => isDynamicToolPartLike(part) && classifyToolRender(part.toolName).kind !== "hidden",
  );
  const isThinking = streaming && !hasVisibleText && !hasVisibleTools;
  const hasStreamingText = normalizedParts.some(
    (part) => isTextPartLike(part) && part.state === "streaming",
  );
  const showTail = streaming && !isThinking && !hasStreamingText;

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
      { length: normalizedParts.length },
      () => null,
    );

    for (let index = normalizedParts.length - 1; index >= 0; index -= 1) {
      const part = normalizedParts[index];

      if (isTextPartLike(part)) {
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

      if (isReasoningPartLike(part)) {
        nextItems[index] = {
          kind: "text",
          key: `reasoning:${index}`,
          node: (
            <ReasoningContent
              key={`reasoning:${index}`}
              text={part.reasoning}
              isStreaming={streaming && part.state === "streaming"}
            />
          ),
        };
        continue;
      }

      if (!isDynamicToolPartLike(part)) continue;
      const policy = classifyToolRender(part.toolName);
      if (policy.kind === "hidden") continue;

      const toolCallId = part.toolCallId;

      if (policy.kind === "subagent") {
        nextItems[index] = {
          kind: "tool",
          key: `subagent:${toolCallId}:${index}`,
          toolCallId,
          meta: { renderKind: "subagent", part },
          node: (
            <SubagentTool
              key={`subagent:${toolCallId}:${index}`}
              part={part}
              sessionKey={sessionKey}
            />
          ),
        };
        continue;
      }

      if (policy.kind === "exec" && isExecToolName(part.toolName)) {
        nextItems[index] = {
          kind: "tool",
          key: `exec:${toolCallId}:${index}`,
          toolCallId,
          meta: { renderKind: "exec", part },
          node: (
            <ExecTool key={`exec:${toolCallId}:${index}`} part={part} sessionKey={sessionKey} />
          ),
        };
        continue;
      }

      nextItems[index] = {
        kind: "tool",
        key: `tool:${toolCallId}:${index}`,
        toolCallId,
        meta: { renderKind: "explore", part },
        node: <span key={`tool:${toolCallId}:${index}`} />,
      };
    }

    const aggregated = aggregateRenderableItems(nextItems);
    const exploredGrouped = groupExploreTools(aggregated);
    const execGrouped = groupExecTools(exploredGrouped, sessionKey);
    return execGrouped.map((item) => item.node);
  }, [normalizedParts, sessionKey, streaming]);

  if (!nodes.length && !showIndicator && !showTail) return null;

  return (
    <div className="space-y-3">
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
      {nodes}
      {showTail ? (
        <div className="text-muted-foreground" aria-label="thinking">
          <span className="claw-text-shimmer">{t("thinking.active")}</span>
        </div>
      ) : null}
    </div>
  );
}
