import { useEffect, useRef } from "react";
import type { SubagentHistoryMessage } from "@/store/subagents";
import { ipc } from "@/lib/ipc";
import { useSubagentsStore, selectSelectedNode } from "@/store/subagents";

const POLL_INTERVAL_MS = 2_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseMessages(raw: unknown): SubagentHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((m) => ({
    role: (typeof m.role === "string" ? m.role : "system") as SubagentHistoryMessage["role"],
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
    timestampMs: typeof m.timestampMs === "number" ? m.timestampMs : undefined,
  }));
}

export function useSubagentPolling() {
  const node = useSubagentsStore(selectSelectedNode);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!node || !node.sessionKey) return;

    const fetchHistory = () => {
      ipc.chat
        .request("chat.history", { sessionKey: node.sessionKey, limit: 50 })
        .then((res) => {
          const data = isRecord(res) ? res : null;
          const messages = parseMessages(data?.messages ?? data?.history ?? res);
          useSubagentsStore.getState().setHistory(node.runId, messages);
        })
        .catch(() => {
          // silently ignore — node may have been cleaned up
        });
    };

    // Fetch immediately
    fetchHistory();

    // Poll only if still running
    if (node.status === "running" || node.status === "spawning") {
      timerRef.current = setInterval(fetchHistory, POLL_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [node?.runId, node?.sessionKey, node?.status]);
}
