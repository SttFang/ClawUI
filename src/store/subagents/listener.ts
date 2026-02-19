import type { ChatNormalizedRunEvent } from "@clawui/types";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import type { SubagentNode } from "./types";
import { useSubagentsStore } from "./store";

let listenerInitialized = false;

const AUTO_CLOSE_DELAY_MS = 5_000;
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Unwrap a tool result that may be wrapped in `{ content: [{ type: "text", text: JSON }] }`
 * format (produced by OpenClaw's `jsonResult()` helper).
 */
function unwrapToolResult(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  // Already a plain object with status field (direct result)
  if (typeof raw.status === "string") return raw;
  // Wrapped in content array
  const content = Array.isArray(raw.content) ? raw.content : null;
  if (!content) return null;
  for (const item of content) {
    if (isRecord(item) && item.type === "text" && typeof item.text === "string") {
      try {
        const parsed = JSON.parse(item.text);
        if (isRecord(parsed)) return parsed;
      } catch {
        /* not JSON */
      }
    }
  }
  return null;
}

function parseSpawnResult(event: ChatNormalizedRunEvent): SubagentNode | null {
  const meta = isRecord(event.metadata) ? event.metadata : null;
  if (!meta) return null;
  if (typeof meta.name !== "string" || meta.name !== "sessions_spawn") return null;

  const result = unwrapToolResult(meta.result);
  if (!result) return null;

  // OpenClaw returns `childSessionKey` (not `sessionKey`)
  const sessionKey = pickString(result, "childSessionKey");
  const runId = pickString(result, "runId");
  if (!sessionKey || !runId) return null;

  // Args are available in run.tool_started but not in run.tool_finished;
  // fall back to empty values when absent.
  const args = isRecord(meta.args) ? meta.args : null;
  const task = args && typeof args.task === "string" ? args.task.trim() : "";
  const model = args && typeof args.model === "string" ? args.model.trim() : undefined;
  const label = args && typeof args.label === "string" ? args.label.trim() : undefined;

  return {
    runId,
    sessionKey,
    parentSessionKey: event.sessionKey,
    task: task || label || "subagent",
    label,
    model,
    status: "running",
    createdAt: event.timestampMs || Date.now(),
  };
}

function scheduleAutoClose() {
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(() => {
    const state = useSubagentsStore.getState();
    const nodes = Object.values(state.nodes);
    const allDone =
      nodes.length > 0 &&
      nodes.every((n) => n.status === "done" || n.status === "error" || n.status === "timeout");
    if (allDone) {
      useSubagentsStore.getState().togglePanel(false);
    }
    autoCloseTimer = null;
  }, AUTO_CLOSE_DELAY_MS);
}

function startWaiting(node: SubagentNode) {
  ipc.chat
    .request("agent.wait", { runId: node.runId, timeoutMs: 120_000 })
    .then((res) => {
      const result = isRecord(res) ? res : null;
      const ok = result?.ok === true;
      const status = ok ? "done" : "error";
      const error = !ok && typeof result?.error === "string" ? result.error : undefined;
      useSubagentsStore.getState().updateStatus(node.runId, status, error);
      scheduleAutoClose();
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.toLowerCase().includes("timeout");
      useSubagentsStore.getState().updateStatus(node.runId, isTimeout ? "timeout" : "error", msg);
      scheduleAutoClose();
    });
}

/** Cache args from tool_started so they're available when tool_finished fires. */
const pendingSpawnArgs = new Map<string, Record<string, unknown>>();

export function initSubagentsListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
    const meta = isRecord(event.metadata) ? event.metadata : null;
    const toolName = meta && typeof meta.name === "string" ? meta.name : "";

    // Cache args from tool_started for later use in tool_finished
    if (event.kind === "run.tool_started" && toolName === "sessions_spawn") {
      const toolCallId = typeof meta?.toolCallId === "string" ? meta.toolCallId : "";
      const args = isRecord(meta?.args) ? (meta.args as Record<string, unknown>) : null;
      if (toolCallId && args) {
        pendingSpawnArgs.set(toolCallId, args);
      }
      return;
    }

    if (event.kind !== "run.tool_finished") return;
    if (toolName !== "sessions_spawn") return;

    // Merge cached args into metadata for parseSpawnResult
    const toolCallId = meta && typeof meta.toolCallId === "string" ? meta.toolCallId : "";
    if (toolCallId && pendingSpawnArgs.has(toolCallId)) {
      const cachedArgs = pendingSpawnArgs.get(toolCallId)!;
      pendingSpawnArgs.delete(toolCallId);
      if (meta && !isRecord(meta.args)) {
        meta.args = cachedArgs;
      }
    }

    const node = parseSpawnResult(event);
    if (!node) {
      chatLog.warn(
        "[subagent.detect.failed]",
        `toolCallId=${toolCallId}`,
        `result=${JSON.stringify(meta?.result ?? null).slice(0, 200)}`,
      );
      return;
    }

    chatLog.info(
      "[subagent.spawned]",
      `runId=${node.runId}`,
      `session=${node.sessionKey}`,
      `task=${node.task}`,
      `parent=${node.parentSessionKey}`,
    );

    useSubagentsStore.getState().add(node);
    startWaiting(node);
  });
}

/** Exported for testing */
export { parseSpawnResult };
