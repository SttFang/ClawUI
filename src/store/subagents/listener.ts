import type { ChatNormalizedRunEvent } from "@clawui/types";
import { normalizeToolCallId } from "@clawui/types/tool-call";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import type { SubagentNode } from "./types";
import { useSubagentsStore } from "./store";

let listenerInitialized = false;

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
  if (typeof raw.status === "string") return raw;
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

/** Extract args from a tool_started event's metadata. */
function parseSpawnArgs(meta: Record<string, unknown>) {
  const args = isRecord(meta.args) ? meta.args : null;
  const task = args && typeof args.task === "string" ? args.task.trim() : "";
  const model = args && typeof args.model === "string" ? args.model.trim() : undefined;
  const label = args && typeof args.label === "string" ? args.label.trim() : undefined;
  return { task: task || label || "subagent", label, model };
}

/**
 * Parse spawn result from metadata (works when verboseLevel=full and result is present).
 * Returns null if result is missing (gateway strips it by default).
 */
function parseSpawnResult(event: ChatNormalizedRunEvent): SubagentNode | null {
  const meta = isRecord(event.metadata) ? event.metadata : null;
  if (!meta) return null;
  if (typeof meta.name !== "string" || meta.name !== "sessions_spawn") return null;

  const result = unwrapToolResult(meta.result);
  if (!result) return null;

  const sessionKey = pickString(result, "childSessionKey");
  const runId = pickString(result, "runId");
  if (!sessionKey || !runId) return null;

  const { task, label, model } = parseSpawnArgs(meta);

  return {
    runId,
    toolCallId: "",
    sessionKey,
    parentSessionKey: event.sessionKey,
    task,
    label,
    model,
    status: "running",
    createdAt: event.timestampMs || Date.now(),
  };
}

/**
 * Search chat.history messages for a tool result matching the given toolCallId.
 *
 * OpenClaw transcripts use `role: "toolResult"` with `toolCallId` (full composite ID)
 * and a `details` object containing the parsed result. The `content` array also has
 * the JSON-stringified result.
 */
function findSpawnResultInHistory(
  messages: unknown[],
  toolCallId: string,
): { childSessionKey: string; runId: string } | null {
  const baseId = toolCallId.includes("|") ? toolCallId.split("|")[0] : toolCallId;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!isRecord(msg)) continue;

    // --- Format A: OpenClaw transcript (role: "toolResult", toolCallId) ---
    if (
      (msg.role === "toolResult" || msg.role === "tool_result") &&
      typeof msg.toolCallId === "string"
    ) {
      const msgTcId = msg.toolCallId as string;
      const msgBase = msgTcId.includes("|") ? msgTcId.split("|")[0] : msgTcId;
      if (msgTcId !== toolCallId && msgBase !== baseId) continue;

      // Try details first (pre-parsed)
      if (isRecord(msg.details)) {
        const sk = pickString(msg.details, "childSessionKey");
        const rid = pickString(msg.details, "runId");
        if (sk && rid) return { childSessionKey: sk, runId: rid };
      }
      // Fall back to content array
      const content = Array.isArray(msg.content) ? msg.content : null;
      if (content) {
        for (const item of content) {
          if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") continue;
          try {
            const parsed = JSON.parse(item.text);
            if (!isRecord(parsed)) continue;
            const sk = pickString(parsed, "childSessionKey");
            const rid = pickString(parsed, "runId");
            if (sk && rid) return { childSessionKey: sk, runId: rid };
          } catch {
            /* not JSON */
          }
        }
      }
      continue;
    }

    // --- Format B: Anthropic API (role: "user", tool_result content blocks) ---
    const content = Array.isArray(msg.content) ? msg.content : null;
    if (!content) continue;
    for (const block of content) {
      if (!isRecord(block) || block.type !== "tool_result") continue;
      const blockId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
      if (blockId !== toolCallId && blockId !== baseId) continue;
      const innerContent = Array.isArray(block.content) ? block.content : null;
      if (!innerContent) continue;
      for (const inner of innerContent) {
        if (!isRecord(inner) || inner.type !== "text" || typeof inner.text !== "string") continue;
        try {
          const parsed = JSON.parse(inner.text);
          if (!isRecord(parsed)) continue;
          const sk = pickString(parsed, "childSessionKey");
          const rid = pickString(parsed, "runId");
          if (sk && rid) return { childSessionKey: sk, runId: rid };
        } catch {
          /* not JSON */
        }
      }
    }
  }
  return null;
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
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.toLowerCase().includes("timeout");
      useSubagentsStore.getState().updateStatus(node.runId, isTimeout ? "timeout" : "error", msg);
    });
}

/** Fetch parent session history and resolve spawn data. Retries with increasing delay. */
async function resolveSpawnFromHistory(
  parentSessionKey: string,
  toolCallId: string,
  retries = 2,
): Promise<{ childSessionKey: string; runId: string } | null> {
  const baseId = toolCallId.includes("|") ? toolCallId.split("|")[0] : toolCallId;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 + attempt * 1000));
    try {
      const res = await ipc.chat.request("chat.history", {
        sessionKey: parentSessionKey,
        limit: 30,
      });
      if (!isRecord(res) || !Array.isArray(res.messages)) continue;
      const msgs = res.messages as unknown[];

      // Debug: log last few message roles to understand transcript format
      const tail = msgs.slice(-6).map((m) => {
        if (!isRecord(m as unknown)) return "?";
        const r = (m as Record<string, unknown>).role;
        const tcId = (m as Record<string, unknown>).toolCallId;
        return `${r}${tcId ? `(${String(tcId).slice(0, 20)}…)` : ""}`;
      });
      chatLog.debug(
        "[subagent.history.scan]",
        `attempt=${attempt}`,
        `total=${msgs.length}`,
        `tail=[${tail.join(", ")}]`,
        `looking=${baseId}`,
      );

      const found = findSpawnResultInHistory(msgs, toolCallId);
      if (found) return found;
    } catch (err) {
      chatLog.warn(
        "[subagent.history.fetch.error]",
        `session=${parentSessionKey}`,
        `error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return null;
}

/** Cache args from tool_started so they're available when tool_finished fires. */
const pendingSpawnArgs = new Map<string, Record<string, unknown>>();

export function initSubagentsListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.chat.onNormalizedEvent((event: ChatNormalizedRunEvent) => {
    const meta = isRecord(event.metadata) ? event.metadata : null;
    const toolName = meta && typeof meta.name === "string" ? meta.name : "";
    if (toolName !== "sessions_spawn") return;

    const toolCallId = typeof meta?.toolCallId === "string" ? meta.toolCallId : "";
    if (!toolCallId) return;

    // --- Phase 1: tool_started → add "spawning" node ---
    if (event.kind === "run.tool_started") {
      const args = isRecord(meta?.args) ? (meta.args as Record<string, unknown>) : null;
      if (args) pendingSpawnArgs.set(toolCallId, args);

      const { task, label, model } = parseSpawnArgs(meta!);
      const node: SubagentNode = {
        runId: toolCallId, // temporary key; replaced by resolveSpawn
        toolCallId: normalizeToolCallId(toolCallId),
        sessionKey: "",
        parentSessionKey: event.sessionKey,
        task,
        label,
        model,
        status: "spawning",
        createdAt: event.timestampMs || Date.now(),
      };

      chatLog.info("[subagent.spawning]", `toolCallId=${toolCallId}`, `task=${task}`);
      useSubagentsStore.getState().add(node);
      return;
    }

    // --- Phase 2: tool_finished → resolve childSessionKey ---
    if (event.kind !== "run.tool_finished") return;

    // Merge cached args
    if (pendingSpawnArgs.has(toolCallId)) {
      const cachedArgs = pendingSpawnArgs.get(toolCallId)!;
      pendingSpawnArgs.delete(toolCallId);
      if (meta && !isRecord(meta.args)) meta.args = cachedArgs;
    }

    const isError = meta?.isError === true;
    if (isError) {
      useSubagentsStore.getState().updateStatus(toolCallId, "error", "spawn failed");
      return;
    }

    // Fast path: result available (verboseLevel=full)
    const directNode = parseSpawnResult(event);
    if (directNode) {
      chatLog.info(
        "[subagent.spawned]",
        `runId=${directNode.runId}`,
        `session=${directNode.sessionKey}`,
      );
      useSubagentsStore
        .getState()
        .resolveSpawn(toolCallId, directNode.runId, directNode.sessionKey);
      startWaiting(directNode);
      return;
    }

    // Slow path: fetch chat.history to find the tool_result
    chatLog.debug("[subagent.resolve.history]", `toolCallId=${toolCallId}`);
    void resolveSpawnFromHistory(event.sessionKey, toolCallId).then((found) => {
      if (!found) {
        chatLog.warn("[subagent.resolve.failed]", `toolCallId=${toolCallId}`);
        useSubagentsStore.getState().updateStatus(toolCallId, "error", "could not resolve spawn");
        return;
      }

      chatLog.info(
        "[subagent.spawned]",
        `runId=${found.runId}`,
        `session=${found.childSessionKey}`,
      );
      useSubagentsStore.getState().resolveSpawn(toolCallId, found.runId, found.childSessionKey);

      const node = useSubagentsStore.getState().nodes[found.runId];
      if (node) startWaiting(node);
    });
  });
}

/** Exported for testing */
export { parseSpawnResult, findSpawnResultInHistory };
