import type { GatewayEventFrame } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import {
  isRecord,
  makeExecApprovalKey,
  normalizeSessionKey,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  prune,
} from "./helpers";
import { useExecApprovalsStore } from "./store";

let listenerInitialized = false;

export function initExecApprovalsListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.gateway.onEvent((event: GatewayEventFrame) => {
    if (!event || event.type !== "event") return;

    if (event.event === "exec.approval.requested") {
      const entry = parseExecApprovalRequested(event.payload);
      if (!entry) return;
      useExecApprovalsStore.getState().add(entry);

      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        useExecApprovalsStore.getState().remove(entry.id);
      }, delay);
      return;
    }

    if (event.event === "exec.approval.resolved") {
      const resolved = parseExecApprovalResolved(event.payload);
      if (!resolved) return;

      useExecApprovalsStore.setState(
        (state) => {
          const currentQueue = prune(state.queue);
          const current = currentQueue.find((entry) => entry.id === resolved.id) ?? null;
          const nextQueue = currentQueue.filter((entry) => entry.id !== resolved.id);

          let nextRunningByKey = state.runningByKey;
          const command = current?.request.command?.trim() ?? "";
          const sessionKey = normalizeSessionKey(current?.request.sessionKey);
          if (resolved.decision === "deny" && command) {
            const runningKey = makeExecApprovalKey(sessionKey, command);
            if (nextRunningByKey[runningKey]) {
              const { [runningKey]: _ignored, ...rest } = nextRunningByKey;
              nextRunningByKey = rest;
            }
          }

          let nextLastResolved = state.lastResolvedBySession;
          if (sessionKey && resolved.decision) {
            nextLastResolved = {
              ...state.lastResolvedBySession,
              [sessionKey]: {
                id: resolved.id,
                decision: resolved.decision,
                atMs: resolved.atMs,
              },
            };
          }

          return {
            queue: nextQueue,
            runningByKey: nextRunningByKey,
            lastResolvedBySession: nextLastResolved,
          };
        },
        false,
        "execApprovals/listener/resolved",
      );
      return;
    }

    if (event.event !== "agent" || !isRecord(event.payload)) return;

    const payload = event.payload as Record<string, unknown>;
    if (payload.stream !== "tool") return;

    const data = isRecord(payload.data) ? (payload.data as Record<string, unknown>) : null;
    if (!data) return;

    const toolName = typeof data.name === "string" ? data.name.trim() : "";
    if (toolName !== "exec") return;

    const phase = typeof data.phase === "string" ? data.phase : "";
    const isTerminal = phase === "result" || phase === "error" || phase === "end";
    if (!isTerminal) return;

    const sessionKey = normalizeSessionKey(
      typeof payload.sessionKey === "string" ? payload.sessionKey : null,
    );
    if (!sessionKey) return;

    const args = isRecord(data.args) ? (data.args as Record<string, unknown>) : null;
    const command = typeof args?.command === "string" ? args.command.trim() : "";
    if (command) {
      useExecApprovalsStore.getState().clearRunning(sessionKey, command);
      return;
    }

    // Some gateways only include `args.command` in tool start events; terminal payloads can omit it.
    useExecApprovalsStore.getState().clearRunningForSession(sessionKey);
  });
}
