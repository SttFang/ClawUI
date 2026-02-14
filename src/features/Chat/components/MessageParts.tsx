import type { DynamicToolUIPart, UIMessage } from "ai";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExecTraceUpdatePayload } from "@/store/a2uiExecTrace/types";
import { ExecActionItem, ToolEventCard } from "@/components/A2UI";
import {
  applyExecTraceUpdateToContext,
  buildExecTraceKey,
  createExecTraceContext,
  deriveNextExecTrace,
  isExecPreliminary,
  type ExecTrace,
  shouldSuppressExecPart,
} from "@/components/A2UI/execTrace";
import { useA2UIExecTraceStore } from "@/store/a2uiExecTrace/store";
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

function readCommandFromInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const value = (input as Record<string, unknown>).command;
  return typeof value === "string" ? value.trim() : "";
}

function traceStatusPriority(trace: ExecTrace): number {
  if (trace.status === "error") return 4;
  if (trace.status === "completed") return 3;
  if (trace.status === "running") return 2;
  return 1;
}

function pickPreferredTrace(current: ExecTrace, candidate: ExecTrace): ExecTrace {
  const currentPriority = traceStatusPriority(current);
  const candidatePriority = traceStatusPriority(candidate);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }
  if (candidate.toolOrder !== null && current.toolOrder !== null) {
    if (candidate.toolOrder !== current.toolOrder) {
      return candidate.toolOrder > current.toolOrder ? candidate : current;
    }
  } else if (candidate.toolOrder !== null && current.toolOrder === null) {
    return candidate;
  } else if (candidate.toolOrder === null && current.toolOrder !== null) {
    return current;
  }
  if (candidate.startedAtMs !== current.startedAtMs) {
    return candidate.startedAtMs > current.startedAtMs ? candidate : current;
  }
  if ((candidate.endedAtMs ?? 0) !== (current.endedAtMs ?? 0)) {
    return (candidate.endedAtMs ?? 0) > (current.endedAtMs ?? 0) ? candidate : current;
  }
  return candidate.traceKey > current.traceKey ? candidate : current;
}

function mergePendingUpdate(
  updates: Map<string, ExecTraceUpdatePayload>,
  incoming: ExecTraceUpdatePayload,
): void {
  const current = updates.get(incoming.trace.traceKey);
  if (!current) {
    updates.set(incoming.trace.traceKey, incoming);
    return;
  }
  const preferredTrace = pickPreferredTrace(current.trace, incoming.trace);
  updates.set(incoming.trace.traceKey, {
    trace: preferredTrace,
    terminal: incoming.terminal ?? current.terminal,
  });
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

function aggregateRenderableItems(items: (RenderableItem | null)[]): RenderableItem[] {
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

  const renderResult = useMemo(() => {
    const hasToolPart = message.parts.some((part) => isDynamicToolPartLike(part));
    const foldToolReceiptText = message.role !== "user" && hasToolPart;
    const context = createExecTraceContext();
    const pendingUpdatesByTraceKey = new Map<string, ExecTraceUpdatePayload>();
    const nextItems: (RenderableItem | null)[] = Array.from(
      { length: message.parts.length },
      () => null,
    );
    const now = Date.now();

    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];
      if (isTextPartLike(part)) {
        if (!part.text.trim()) continue;
        if (foldToolReceiptText && isLikelyToolReceiptText(part.text)) continue;
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
      if (!isExecLikeToolName(part.toolName)) {
        nextItems[index] = {
          kind: "tool",
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
        continue;
      }

      const traceKey = buildExecTraceKey(sessionKey, part.toolCallId);
      const existing = context.tracesByKey[traceKey];
      const commandCandidate = readCommandFromInput(part.input) || existing?.command || "";
      const commandKey = commandCandidate ? `${sessionKey}::${commandCandidate}` : "";
      const currentTerminal = commandKey ? context.terminalByCommand[commandKey] : undefined;
      const derived = deriveNextExecTrace({
        part,
        sessionKey,
        existing,
        currentTerminal,
        now,
      });
      applyExecTraceUpdateToContext(context, derived);
      mergePendingUpdate(pendingUpdatesByTraceKey, {
        trace: derived.nextTrace,
        terminal:
          derived.commandKey && derived.nextTerminal
            ? { commandKey: derived.commandKey, terminal: derived.nextTerminal }
            : undefined,
      });

      if (
        shouldSuppressExecPart(part, sessionKey, {
          trace: derived.nextTrace,
          tracesByKey: context.tracesByKey,
          terminalByCommand: context.terminalByCommand,
        })
      ) {
        continue;
      }

      if (
        part.state === "input-available" ||
        part.state === "input-streaming" ||
        part.state === "output-error" ||
        (part.state === "output-available" && isExecPreliminary(part)) ||
        (part.state === "output-available" && derived.nextTrace.status !== "running")
      ) {
        nextItems[index] = {
          kind: "tool",
          key:
            derived.nextTrace.status === "completed" || derived.nextTrace.status === "error"
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
    }

    return {
      nodes: aggregateRenderableItems(nextItems).map((item) => item.node),
      pendingUpdates: Array.from(pendingUpdatesByTraceKey.values()),
    };
  }, [message.parts, message.role, sessionKey, streaming]);

  useEffect(() => {
    if (!renderResult.pendingUpdates.length) return;
    useA2UIExecTraceStore.getState().batchSet(renderResult.pendingUpdates);
  }, [renderResult.pendingUpdates]);

  return (
    <div className="space-y-3">
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
      {renderResult.nodes}
    </div>
  );
}
