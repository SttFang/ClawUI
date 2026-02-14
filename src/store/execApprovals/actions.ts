import { ipc } from "@/lib/ipc";
import type { ExecApprovalDecision, ExecApprovalsActions, ExecApprovalsStore } from "./types";
import { EXEC_RUNNING_TTL_MS, makeExecApprovalKey, normalizeSessionKey, prune } from "./helpers";

type SetExecApprovalsState = (
  partial:
    | Partial<ExecApprovalsStore>
    | ((state: ExecApprovalsStore) => Partial<ExecApprovalsStore> | ExecApprovalsStore),
  replace?: false,
  action?: string,
) => void;

type GetExecApprovalsState = () => ExecApprovalsStore;

export function createExecApprovalsActions(
  set: SetExecApprovalsState,
  get: GetExecApprovalsState,
): ExecApprovalsActions {
  return {
    add: (entry) => {
      set(
        (state) => {
          const nextQueue = prune(state.queue).filter((item) => item.id !== entry.id);
          nextQueue.push(entry);
          nextQueue.sort((a, b) => b.createdAtMs - a.createdAtMs);
          return { queue: nextQueue };
        },
        false,
        "execApprovals/add",
      );
    },

    remove: (id) => {
      set(
        (state) => ({
          queue: prune(state.queue).filter((item) => item.id !== id),
        }),
        false,
        "execApprovals/remove",
      );
    },

    clearRunning: (sessionKey, command) => {
      set(
        (state) => {
          const key = makeExecApprovalKey(normalizeSessionKey(sessionKey), command);
          if (!state.runningByKey[key]) return state;
          const { [key]: _ignored, ...rest } = state.runningByKey;
          return { ...state, runningByKey: rest };
        },
        false,
        "execApprovals/clearRunning",
      );
    },

    clearRunningForSession: (sessionKey) => {
      set(
        (state) => {
          const prefix = `${normalizeSessionKey(sessionKey)}::`;
          const next = Object.fromEntries(
            Object.entries(state.runningByKey).filter(([key]) => !key.startsWith(prefix)),
          );
          if (Object.keys(next).length === Object.keys(state.runningByKey).length) return state;
          return { ...state, runningByKey: next };
        },
        false,
        "execApprovals/clearRunningForSession",
      );
    },

    resolve: async (id: string, decision: ExecApprovalDecision) => {
      const snapshot = get();
      const current = snapshot.queue.find((item) => item.id === id) ?? null;
      const sessionKey = normalizeSessionKey(current?.request.sessionKey);
      const command = current?.request.command?.trim() ?? "";
      const traceId = current?.request.traceId?.trim() ?? "";
      const runId = current?.request.runId?.trim() ?? "";
      const toolCallId = current?.request.toolCallId?.trim() ?? "";
      const runningKey = command ? makeExecApprovalKey(sessionKey, command) : "";
      const shouldMarkRunning =
        (decision === "allow-once" || decision === "allow-always") && !!runningKey;

      if (shouldMarkRunning) {
        const atMs = Date.now();
        set(
          (state) => ({ runningByKey: { ...state.runningByKey, [runningKey]: atMs } }),
          false,
          "execApprovals/resolve/markRunning",
        );

        window.setTimeout(() => {
          set(
            (state) => {
              const ts = state.runningByKey[runningKey];
              if (!ts) return state;
              if (Date.now() - ts < EXEC_RUNNING_TTL_MS) return state;
              const { [runningKey]: _ignored, ...rest } = state.runningByKey;
              return { ...state, runningByKey: rest };
            },
            false,
            "execApprovals/resolve/markRunning/ttl",
          );
        }, EXEC_RUNNING_TTL_MS + 1000);
      }

      set(
        (state) => ({ busyById: { ...state.busyById, [id]: true } }),
        false,
        "execApprovals/resolve/busy",
      );

      let resolvedAtMs = Date.now();
      let requestOk = false;
      let requestError: unknown = null;
      try {
        await ipc.chat.request("exec.approval.resolve", {
          id,
          decision,
          sessionKey: sessionKey || undefined,
          command: command || undefined,
          traceId: traceId || undefined,
          runId: runId || undefined,
          toolCallId: toolCallId || undefined,
        });
        requestOk = true;
        resolvedAtMs = Date.now();
      } catch (error) {
        requestError = error;
      } finally {
        set(
          (state) => {
            const { [id]: _ignored, ...rest } = state.busyById;
            return { busyById: rest };
          },
          false,
          "execApprovals/resolve/done",
        );
      }

      if (!requestOk) {
        if (shouldMarkRunning) {
          set(
            (state) => {
              if (!state.runningByKey[runningKey]) return state;
              const { [runningKey]: _ignored, ...rest } = state.runningByKey;
              return { ...state, runningByKey: rest };
            },
            false,
            "execApprovals/resolve/rollbackRunning",
          );
        }
        if (requestError) throw requestError;
        return;
      }

      set(
        (state) => {
          const nextQueue = prune(state.queue).filter((item) => item.id !== id);

          let nextRunningByKey = state.runningByKey;
          if (decision === "deny" && runningKey && nextRunningByKey[runningKey]) {
            const { [runningKey]: _ignored, ...rest } = nextRunningByKey;
            nextRunningByKey = rest;
          }

          let nextLastResolved = state.lastResolvedBySession;
          if (sessionKey) {
            nextLastResolved = {
              ...state.lastResolvedBySession,
              [sessionKey]: { id, decision, atMs: resolvedAtMs },
            };
          }

          return {
            queue: nextQueue,
            runningByKey: nextRunningByKey,
            lastResolvedBySession: nextLastResolved,
          };
        },
        false,
        "execApprovals/resolve/commit",
      );
    },
  };
}
