import type { UIMessage } from "ai";
import type { DynamicToolUIPart } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExecActionItem, ToolEventCard } from "@/components/A2UI";
import {
  isExecPreliminary,
  shouldSuppressExecPart,
  upsertExecTrace,
} from "@/components/A2UI/execTrace";
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

function normalizeToolReceiptText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isLikelyToolReceiptText(value: string): boolean {
  const normalized = normalizeToolReceiptText(value);
  if (!normalized) return false;
  return (
    normalized.startsWith("system:") ||
    normalized.includes("approval required") ||
    normalized.includes("approve to run") ||
    normalized.includes("exec finished") ||
    normalized.includes("enoent:") ||
    (normalized.startsWith("{") && normalized.includes('"status"') && normalized.includes('"tool"'))
  );
}

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

function isExecLikeToolName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "exec" || normalized === "bash";
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

function pickMessageRenderableItem(
  part: unknown,
  index: number,
  sessionKey: string,
  streaming: boolean,
  options?: { foldToolReceiptText?: boolean },
) {
  if (isTextPartLike(part)) {
    if (!part.text.trim()) return null;
    if (options?.foldToolReceiptText && isLikelyToolReceiptText(part.text)) return null;
    return {
      kind: "text" as const,
      key: `text:${index}`,
      node: (
        <MessageText
          key={`text:${index}`}
          text={part.text}
          isAnimating={streaming && part.state === "streaming"}
        />
      ),
    };
  }

  if (isDynamicToolPartLike(part)) {
    if (isExecLikeToolName(part.toolName)) {
      if (shouldSuppressExecPart(part, sessionKey)) {
        return null;
      }
      const trace = upsertExecTrace(part, sessionKey);
      if (
        part.state === "input-available" ||
        part.state === "input-streaming" ||
        part.state === "output-error" ||
        (part.state === "output-available" && isExecPreliminary(part)) ||
        (part.state === "output-available" && trace.status !== "running")
      ) {
        return {
          kind: "tool" as const,
          key:
            trace.status === "completed" || trace.status === "error"
              ? `exec:${part.toolCallId}:final:${index}`
              : `exec:${part.toolCallId}:${index}`,
          toolCallId: part.toolCallId,
          node: (
            <ExecActionItem
              key={`exec:${part.toolCallId}:${index}`}
              part={part}
              sessionKey={sessionKey}
            />
          ),
        };
      }

      return null;
    }

    return {
      kind: "tool" as const,
      key: `tool:${part.toolCallId}:${index}`,
      toolCallId: part.toolCallId,
      node: (
        <ToolEventCard
          key={`tool:${part.toolCallId}:${index}`}
          part={part}
          sessionKey={sessionKey}
        />
      ),
    };
  }

  return null;
}

function aggregateRenderableItems(
  items: ReturnType<typeof pickMessageRenderableItem>[],
): RenderableItem[] {
  const execIndexByToolCallId = new Map<string, number>();
  const result: RenderableItem[] = [];

  for (const item of items) {
    if (!item) continue;

    if (item.kind === "tool") {
      const idx = execIndexByToolCallId.get(item.toolCallId);
      if (idx !== undefined) {
        result[idx] = item;
        continue;
      }

      execIndexByToolCallId.set(item.toolCallId, result.length);
      result.push(item);
      continue;
    }

    result.push(item);
  }

  return result;
}

function primeExecTrace(parts: UIMessage["parts"], sessionKey: string): void {
  for (const part of parts) {
    if (!isDynamicToolPartLike(part)) continue;
    if (!isExecLikeToolName(part.toolName)) continue;
    upsertExecTrace(part, sessionKey);
  }
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
    return undefined;
  }, [isThinking]);

  const renderedItems = useMemo(() => {
    const hasToolPart = message.parts.some((part) => isDynamicToolPartLike(part));
    const foldToolReceiptText = message.role !== "user" && hasToolPart;
    primeExecTrace(message.parts, sessionKey);
    const pre = message.parts.map((part, index) =>
      pickMessageRenderableItem(part, index, sessionKey, streaming, {
        foldToolReceiptText,
      }),
    );
    return aggregateRenderableItems(pre).map((item) => item.node);
  }, [message.parts, message.role, sessionKey, streaming]);

  return (
    <div className="space-y-3">
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
      {renderedItems}
    </div>
  );
}
