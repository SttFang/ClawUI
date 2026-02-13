import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ExecActionItem,
  LifecycleEventCard,
  ToolEventCard,
} from "@/components/A2UI";
import {
  isExecPart,
  isExecPreliminary,
  upsertExecTrace,
} from "@/components/A2UI/execTrace";
import { MessageText } from "./MessageText";

const AUTO_HIDE_DELAY = 1500;
const MS_IN_S = 1000;

type RenderableItem =
  | {
      kind: "text";
      key: string;
      node: JSX.Element;
    }
  | {
      kind: "tool";
      key: string;
      node: JSX.Element;
      toolCallId: string;
    }
  | {
      kind: "lifecycle";
      key: string;
      node: JSX.Element;
      signature?: string;
    };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeLifecycleRaw(raw: unknown) {
  if (!isRecord(raw)) return null;
  const runId = pickString(raw.runId) ?? pickString(raw.run_id);
  const sessionId = pickString(raw.sessionKey) ?? pickString(raw.session_id);
  const phase = pickString(raw.phase) ?? pickString(raw.state);
  const seq = pickNumber(raw.seq) ?? pickNumber(raw.sequence);
  const ts = pickNumber(raw.ts) ?? pickNumber(raw.timestamp);
  const error = isRecord(raw.error) || typeof raw.error === "string" ? raw.error : undefined;

  if (!runId && !sessionId && !phase && seq === undefined && ts === undefined && !error) {
    return null;
  }

  return { runId, sessionKey: sessionId, seq, ts, phase, error };
}

function pickMessageRenderableItem(
  part: UIMessage["parts"][number],
  index: number,
  sessionKey: string,
  streaming: boolean,
) {
  if (part.type === "text") {
    if (!part.text.trim()) return null;
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

  if (part.type === "dynamic-tool") {
    if (isExecPart(part)) {
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
          key: trace.status === "completed" || trace.status === "error"
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
      node: <ToolEventCard key={`tool:${part.toolCallId}:${index}`} part={part} sessionKey={sessionKey} />,
    };
  }

  if (part.type === "data-openclaw-lifecycle") {
    const lifecycleData = normalizeLifecycleRaw((part as { data?: unknown }).data ?? part);
    if (!lifecycleData) return null;

    const phase = lifecycleData.phase;
    const sigParts = [
      pickString(lifecycleData.runId) ?? "unknown-run",
      pickString(lifecycleData.sessionKey) ?? "unknown-session",
      pickString(phase) ?? "phase-unknown",
      typeof lifecycleData.seq === "number" ? lifecycleData.seq.toString() : "",
      typeof lifecycleData.ts === "number" ? lifecycleData.ts.toString() : "",
    ];
    const signature = sigParts.join("|");

    return {
      kind: "lifecycle" as const,
      key: `lifecycle:${index}`,
      signature,
      node: <LifecycleEventCard key={`lifecycle:${index}`} data={lifecycleData} />,
    };
  }

  return null;
}

function aggregateRenderableItems(
  items: ReturnType<typeof pickMessageRenderableItem>[],
): RenderableItem[] {
  const execIndexByToolCallId = new Map<string, number>();
  const lifecycleSeenSignature = new Set<string>();
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

    if (item.kind === "lifecycle" && item.signature) {
      if (lifecycleSeenSignature.has(item.signature)) continue;
      lifecycleSeenSignature.add(item.signature);
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

  const renderedItems = useMemo(() => {
    const pre = message.parts.map((part, index) =>
      pickMessageRenderableItem(part, index, sessionKey, streaming),
    );
    return aggregateRenderableItems(pre).map((item) => item.node);
  }, [message.parts, sessionKey, streaming]);

  return (
    <div className="space-y-3">
      {showIndicator ? (
        <ThinkingIndicator isStreaming={isThinking} duration={thinkingDuration} />
      ) : null}
      {renderedItems}
    </div>
  );
}
