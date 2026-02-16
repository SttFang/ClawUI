import type { GatewayEventFrame } from "@/lib/ipc";
import { isExecToolName, isRecord, normalizeCommand, normalizeSessionKey } from "@/lib/exec";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import { resolveToolCallId } from "@clawui/types/tool-call";
import type { ExecLifecycleStatus } from "./types";
import { buildFallbackAttemptId, extractRunIdFromToolCallId } from "./projector";
import { useExecLifecycleStore } from "./store";

let listenerInitialized = false;

function phaseToStatus(phase: string, isExplicitError: boolean): ExecLifecycleStatus | null {
  if (phase === "start") return "running";
  if (phase === "update") return "running";
  if (phase === "result") return "completed";
  if (phase === "error" || isExplicitError) return "error";
  if (phase === "end") return "completed";
  return null;
}

export function initExecLifecycleListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.gateway.onEvent((event: GatewayEventFrame) => {
    if (!event || event.type !== "event") return;
    if (event.event !== "agent" || !isRecord(event.payload)) return;

    const payload = event.payload as Record<string, unknown>;
    if (payload.stream !== "tool") return;

    const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
    if (!data) return;

    const toolName = typeof data.name === "string" ? data.name.trim() : "";
    if (!isExecToolName(toolName)) return;

    const phase = typeof data.phase === "string" ? data.phase : "";
    const isExplicitError = phase === "error" || data.isError === true;
    const status = phaseToStatus(phase, isExplicitError);
    if (!status) return;

    const sessionKey = normalizeSessionKey(
      typeof payload.sessionKey === "string" ? payload.sessionKey : null,
    );
    if (!sessionKey) return;

    const toolCallId = resolveToolCallId(data);
    if (!toolCallId) return;

    const args = isRecord(data.args) ? (data.args as Record<string, unknown>) : null;
    const command = typeof args?.command === "string" ? args.command.trim() : "";
    const runId =
      (typeof payload.runId === "string" ? payload.runId.trim() : "") ||
      extractRunIdFromToolCallId(toolCallId) ||
      "run:unknown";
    const attemptId = buildFallbackAttemptId({
      runId,
      sessionKey,
      command,
      toolCallId,
    });
    const now = typeof payload.ts === "number" ? payload.ts : Date.now();

    chatLog.debug(
      "[execLifecycle.listener]",
      `phase=${phase}`,
      `toolCallId=${toolCallId}`,
      `command=${command || "<none>"}`,
      `status=${status}`,
    );

    useExecLifecycleStore.getState().upsert({
      attemptId,
      lifecycleKey: attemptId,
      runId,
      sessionKey,
      command,
      normalizedCommand: normalizeCommand(command),
      status,
      toolCallId,
      toolName,
      messageId: "",
      partIndex: -1,
      partState:
        status === "completed"
          ? "output-available"
          : status === "error"
            ? "output-error"
            : "input-available",
      preliminary: false,
      startedAtMs: now,
      updatedAtMs: now,
      endedAtMs: status === "completed" || status === "error" ? now : undefined,
      cwd: typeof args?.cwd === "string" ? args.cwd : undefined,
      errorText: typeof data.errorText === "string" ? data.errorText : undefined,
      sourceToolCallIds: [toolCallId],
    });
  });
}
