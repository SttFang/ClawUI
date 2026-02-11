import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, type GatewayEventFrame } from "@/lib/ipc";

export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";

export type ExecApprovalRequestPayload = {
  command: string;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  agentId?: string | null;
  resolvedPath?: string | null;
  sessionKey?: string | null;
};

export type ExecApprovalRequest = {
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseExecApprovalRequested(payload: unknown): ExecApprovalRequest | null {
  if (!isRecord(payload)) return null;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const request = payload.request;
  if (!id || !isRecord(request)) return null;

  const command = typeof request.command === "string" ? request.command.trim() : "";
  if (!command) return null;

  const createdAtMs = typeof payload.createdAtMs === "number" ? payload.createdAtMs : 0;
  const expiresAtMs = typeof payload.expiresAtMs === "number" ? payload.expiresAtMs : 0;
  if (!createdAtMs || !expiresAtMs) return null;

  return {
    id,
    request: {
      command,
      cwd: typeof request.cwd === "string" ? request.cwd : null,
      host: typeof request.host === "string" ? request.host : null,
      security: typeof request.security === "string" ? request.security : null,
      ask: typeof request.ask === "string" ? request.ask : null,
      agentId: typeof request.agentId === "string" ? request.agentId : null,
      resolvedPath: typeof request.resolvedPath === "string" ? request.resolvedPath : null,
      sessionKey: typeof request.sessionKey === "string" ? request.sessionKey : null,
    },
    createdAtMs,
    expiresAtMs,
  };
}

function parseExecApprovalResolved(payload: unknown): { id: string } | null {
  if (!isRecord(payload)) return null;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;
  return { id };
}

function prune(queue: ExecApprovalRequest[]): ExecApprovalRequest[] {
  const now = Date.now();
  return queue.filter((e) => e.expiresAtMs > now);
}

export function makeExecApprovalKey(
  sessionKey: string | null | undefined,
  command: string,
): string {
  return `${sessionKey ?? ""}::${command}`;
}

const EXEC_RUNNING_TTL_MS = 2 * 60 * 1000;

interface ExecApprovalsState {
  queue: ExecApprovalRequest[];
  busyById: Record<string, boolean>;
  runningByKey: Record<string, number>;
}

interface ExecApprovalsActions {
  add: (entry: ExecApprovalRequest) => void;
  remove: (id: string) => void;
  clearRunning: (sessionKey: string | null | undefined, command: string) => void;
  clearRunningForSession: (sessionKey: string | null | undefined) => void;
  resolve: (id: string, decision: ExecApprovalDecision) => Promise<void>;
}

type ExecApprovalsStore = ExecApprovalsState & ExecApprovalsActions;

export const useExecApprovalsStore = create<ExecApprovalsStore>()(
  devtools(
    (set) => ({
      queue: [],
      busyById: {},
      runningByKey: {},

      add: (entry) =>
        set(
          (s) => {
            const next = prune(s.queue).filter((x) => x.id !== entry.id);
            next.push(entry);
            return { queue: next };
          },
          false,
          "add",
        ),

      remove: (id) =>
        set(
          (s) => ({
            queue: prune(s.queue).filter((x) => x.id !== id),
          }),
          false,
          "remove",
        ),

      clearRunning: (sessionKey, command) =>
        set(
          (s) => {
            const key = makeExecApprovalKey(sessionKey, command);
            if (!s.runningByKey[key]) return s;
            const { [key]: _ignored, ...rest } = s.runningByKey;
            return { ...s, runningByKey: rest };
          },
          false,
          "clearRunning",
        ),

      clearRunningForSession: (sessionKey) =>
        set(
          (s) => {
            const prefix = `${sessionKey ?? ""}::`;
            const next = Object.fromEntries(
              Object.entries(s.runningByKey).filter(([key]) => !key.startsWith(prefix)),
            );
            if (Object.keys(next).length === Object.keys(s.runningByKey).length) return s;
            return { ...s, runningByKey: next };
          },
          false,
          "clearRunningForSession",
        ),

      resolve: async (id, decision) => {
        // If user allows an exec, mark it as running immediately (tool output may arrive later).
        if (decision === "allow-once" || decision === "allow-always") {
          const current = useExecApprovalsStore.getState().queue.find((x) => x.id === id) ?? null;
          if (current) {
            const key = makeExecApprovalKey(current.request.sessionKey, current.request.command);
            const atMs = Date.now();
            set(
              (s) => ({ runningByKey: { ...s.runningByKey, [key]: atMs } }),
              false,
              "resolve/markRunning",
            );
            // Best-effort TTL cleanup to avoid stale "running" states.
            window.setTimeout(() => {
              useExecApprovalsStore.setState(
                (s) => {
                  const ts = s.runningByKey[key];
                  if (!ts) return s;
                  if (Date.now() - ts < EXEC_RUNNING_TTL_MS) return s;
                  const { [key]: _ignored, ...rest } = s.runningByKey;
                  return { ...s, runningByKey: rest };
                },
                false,
                "resolve/markRunning/ttl",
              );
            }, EXEC_RUNNING_TTL_MS + 1000);
          }
        }
        set((s) => ({ busyById: { ...s.busyById, [id]: true } }), false, "resolve/busy");
        try {
          await ipc.chat.request("exec.approval.resolve", { id, decision });
        } finally {
          set(
            (s) => {
              const { [id]: _ignored, ...rest } = s.busyById;
              return { busyById: rest };
            },
            false,
            "resolve/done",
          );
        }
      },
    }),
    { name: "ExecApprovalsStore" },
  ),
);

// Selectors
export const selectQueue = (state: ExecApprovalsStore) => state.queue;
export const selectBusyById = (state: ExecApprovalsStore) => state.busyById;
export const selectRunningByKey = (state: ExecApprovalsStore) => state.runningByKey;

export const execApprovalsSelectors = {
  selectQueue,
  selectBusyById,
  selectRunningByKey,
};

let listenerInitialized = false;
export function initExecApprovalsListener() {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.gateway.onEvent((evt: GatewayEventFrame) => {
    if (!evt || evt.type !== "event") return;

    if (evt.event === "exec.approval.requested") {
      const entry = parseExecApprovalRequested(evt.payload);
      if (!entry) return;
      useExecApprovalsStore.getState().add(entry);

      const delay = Math.max(0, entry.expiresAtMs - Date.now() + 500);
      window.setTimeout(() => {
        useExecApprovalsStore.getState().remove(entry.id);
      }, delay);
      return;
    }

    if (evt.event === "exec.approval.resolved") {
      const resolved = parseExecApprovalResolved(evt.payload);
      if (!resolved) return;
      useExecApprovalsStore.getState().remove(resolved.id);
    }
  });
}
