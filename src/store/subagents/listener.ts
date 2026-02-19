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

function parseSpawnResult(event: ChatNormalizedRunEvent): SubagentNode | null {
  const meta = isRecord(event.metadata) ? event.metadata : null;
  if (!meta) return null;
  if (typeof meta.name !== "string" || meta.name !== "sessions_spawn") return null;

  const result = isRecord(meta.result) ? meta.result : null;
  const args = isRecord(meta.args) ? meta.args : null;
  if (!result) return null;

  const childSessionKey = typeof result.sessionKey === "string" ? result.sessionKey.trim() : "";
  const runId = typeof result.runId === "string" ? result.runId.trim() : "";
  if (!childSessionKey || !runId) return null;

  const prompt = args && typeof args.prompt === "string" ? args.prompt.trim() : "";
  const model = args && typeof args.model === "string" ? args.model.trim() : undefined;

  return {
    runId,
    sessionKey: childSessionKey,
    parentSessionKey: event.sessionKey,
    task: prompt || "subagent",
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

export function initSubagentsListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
    if (event.kind !== "run.tool_finished") return;

    const meta = isRecord(event.metadata) ? event.metadata : null;
    const toolName = meta && typeof meta.name === "string" ? meta.name : "";

    // Debug: log all tool_finished events with sessions_spawn
    if (toolName === "sessions_spawn") {
      chatLog.debug(
        "[subagent.detect]",
        `toolName=${toolName}`,
        `metaKeys=${meta ? Object.keys(meta).join(",") : "null"}`,
        `result=${JSON.stringify(meta?.result ?? null)}`,
        `args=${JSON.stringify(meta?.args ?? null)}`,
      );
    }

    const node = parseSpawnResult(event);
    if (!node) return;

    chatLog.info(
      "[subagent.spawned]",
      `runId=${node.runId}`,
      `session=${node.sessionKey}`,
      `parent=${node.parentSessionKey}`,
    );

    useSubagentsStore.getState().add(node);
    startWaiting(node);
  });
}

/** Exported for testing */
export { parseSpawnResult };
