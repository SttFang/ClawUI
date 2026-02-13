import type { GatewayEventFrame } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
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
          let current = currentQueue.find((entry) => entry.id === resolved.id) ?? null;
          let matchedBy: "id" | "session-command" | "unmatched" = current ? "id" : "unmatched";

          if (!current && resolved.sessionKey && resolved.command) {
            const normalizedResolvedSession = normalizeSessionKey(resolved.sessionKey);
            const normalizedResolvedCommand = resolved.command.trim();
            const fallback = currentQueue
              .filter((entry) => {
                const entrySession = normalizeSessionKey(entry.request.sessionKey);
                const entryCommand = entry.request.command?.trim() ?? "";
                return (
                  entrySession === normalizedResolvedSession &&
                  entryCommand === normalizedResolvedCommand
                );
              })
              .sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
            if (fallback) {
              current = fallback;
              matchedBy = "session-command";
            }
          }

          const resolvedEntryId = current?.id ?? resolved.id;
          const nextQueue = currentQueue.filter((entry) => entry.id !== resolvedEntryId);

          let nextRunningByKey = state.runningByKey;
          const command = (current?.request.command ?? resolved.command ?? "").trim();
          const sessionKey = normalizeSessionKey(
            current?.request.sessionKey ?? resolved.sessionKey,
          );
          if (command) {
            const runningKey = makeExecApprovalKey(sessionKey, command);
            if (resolved.decision === "deny") {
              if (nextRunningByKey[runningKey]) {
                const { [runningKey]: _ignored, ...rest } = nextRunningByKey;
                nextRunningByKey = rest;
              }
            } else if (resolved.decision === "allow-once" || resolved.decision === "allow-always") {
              nextRunningByKey = {
                ...nextRunningByKey,
                [runningKey]: resolved.atMs,
              };
            }
          }

          let nextLastResolved = state.lastResolvedBySession;
          if (sessionKey && resolved.decision) {
            nextLastResolved = {
              ...state.lastResolvedBySession,
              [sessionKey]: {
                id: resolvedEntryId,
                decision: resolved.decision,
                atMs: resolved.atMs,
              },
            };
          }

          chatLog.debug(
            "[exec.approvals.resolved]",
            `id=${resolved.id}`,
            `idSource=${resolved.idSource}`,
            `matchedBy=${matchedBy}`,
            `resolvedEntryId=${resolvedEntryId}`,
            `sessionKey=${sessionKey || "<none>"}`,
            `command=${command || "<none>"}`,
          );
          if (!current) {
            chatLog.warn(
              "[exec.approvals.resolved.unmatched]",
              `id=${resolved.id}`,
              `idSource=${resolved.idSource}`,
              `sessionKey=${resolved.sessionKey ?? "<none>"}`,
              `command=${resolved.command ?? "<none>"}`,
            );
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
    const hasResultPayload =
      Object.prototype.hasOwnProperty.call(data, "result") ||
      Object.prototype.hasOwnProperty.call(data, "partialResult");
    const isExplicitError = phase === "error" || data.isError === true;
    const isTerminal =
      phase === "result" ||
      phase === "error" ||
      (phase === "end" && (hasResultPayload || isExplicitError));
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
