import { useEffect, useRef } from "react";
import type {
  SubagentHistoryMessage,
  SubagentMessagePart,
  SubagentStatus,
} from "@/store/subagents";
import { ipc } from "@/lib/ipc";
import { useSubagentsStore } from "@/store/subagents";

const POLL_INTERVAL_MS = 2_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function partsToPlainText(parts: SubagentMessagePart[]): string {
  return parts
    .map((p) => {
      switch (p.type) {
        case "text":
          return p.text;
        case "thinking":
          return `[thinking] ${p.thinking}`;
        case "tool_call":
          return `[tool_call] ${p.toolName}`;
        case "tool_result":
          return `[tool_result] ${p.content.slice(0, 200)}`;
      }
    })
    .join("\n");
}

function parseContentParts(content: unknown): SubagentMessagePart[] {
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content }] : [];
  }
  if (!Array.isArray(content)) {
    return content ? [{ type: "text", text: JSON.stringify(content) }] : [];
  }
  return content.map((block): SubagentMessagePart => {
    if (!isRecord(block)) return { type: "text", text: JSON.stringify(block) };
    switch (block.type) {
      case "text":
        return { type: "text", text: String(block.text ?? "") };
      case "thinking":
        return { type: "thinking", thinking: String(block.thinking ?? "") };
      case "tool_use":
        return {
          type: "tool_call",
          toolCallId: String(block.id ?? ""),
          toolName: String(block.name ?? "unknown"),
          args: isRecord(block.input) ? (block.input as Record<string, unknown>) : {},
        };
      default:
        return { type: "text", text: JSON.stringify(block) };
    }
  });
}

function parseMessages(raw: unknown): SubagentHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((m) => {
    const rawRole = typeof m.role === "string" ? m.role : "system";
    const isToolResult = rawRole === "toolResult" || rawRole === "tool_result";
    const role: SubagentHistoryMessage["role"] = isToolResult
      ? "toolResult"
      : (rawRole as "user" | "assistant" | "system");

    let parts: SubagentMessagePart[];
    if (isToolResult) {
      const resultContent =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
      parts = [
        {
          type: "tool_result",
          toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : String(m.tool_use_id ?? ""),
          content: resultContent,
          isError: m.is_error === true || m.isError === true,
        },
      ];
    } else {
      parts = parseContentParts(m.content);
    }

    return {
      role,
      content: partsToPlainText(parts),
      parts,
      timestampMs: typeof m.timestampMs === "number" ? m.timestampMs : undefined,
    };
  });
}

export function useSubagentHistory(
  runId: string | null,
  sessionKey: string | null,
  status: SubagentStatus | undefined,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!runId || !sessionKey) return;

    const fetchHistory = () => {
      ipc.chat
        .request("chat.history", { sessionKey, limit: 50 })
        .then((res) => {
          const data = isRecord(res) ? res : null;
          const messages = parseMessages(data?.messages ?? data?.history ?? res);
          useSubagentsStore.getState().setHistory(runId, messages);
        })
        .catch(() => {
          // silently ignore — node may have been cleaned up
        });
    };

    fetchHistory();

    if (status === "running" || status === "spawning") {
      timerRef.current = setInterval(fetchHistory, POLL_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [runId, sessionKey, status]);
}
