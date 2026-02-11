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

type LastResolvedApproval = {
  id: string;
  decision: ExecApprovalDecision;
  atMs: number;
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

function parseExecApprovalResolved(payload: unknown): {
  id: string;
  decision: ExecApprovalDecision | null;
  atMs: number;
} | null {
  if (!isRecord(payload)) return null;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;
  const decisionRaw = payload.decision;
  const decision: ExecApprovalDecision | null =
    decisionRaw === "allow-once" || decisionRaw === "allow-always" || decisionRaw === "deny"
      ? decisionRaw
      : null;
  const ts = typeof payload.ts === "number" ? payload.ts : Date.now();
  return { id, decision, atMs: ts };
}

function prune(queue: ExecApprovalRequest[]): ExecApprovalRequest[] {
  const now = Date.now();
  return queue.filter((e) => e.expiresAtMs > now);
}

function normalizeSessionKey(value: string | null | undefined): string {
  return (value ?? "").trim();
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
  lastResolvedBySession: Record<string, LastResolvedApproval>;
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
      lastResolvedBySession: {},

      add: (entry) =>
        set(
          (s) => {
            const next = prune(s.queue).filter((x) => x.id !== entry.id);
            next.push(entry);
            next.sort((a, b) => b.createdAtMs - a.createdAtMs);
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
            const key = makeExecApprovalKey(normalizeSessionKey(sessionKey), command);
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
            const prefix = `${normalizeSessionKey(sessionKey)}::`;
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
        const snapshot = useExecApprovalsStore.getState();
        const current = snapshot.queue.find((x) => x.id === id) ?? null;
        const sessionKey = normalizeSessionKey(current?.request.sessionKey);
        const command = current?.request.command?.trim() ?? "";
        const runningKey = command ? makeExecApprovalKey(sessionKey, command) : "";

        // If user allows an exec, mark it as running immediately (tool output may arrive later).
        if ((decision === "allow-once" || decision === "allow-always") && runningKey) {
          const atMs = Date.now();
          set(
            (s) => ({ runningByKey: { ...s.runningByKey, [runningKey]: atMs } }),
            false,
            "resolve/markRunning",
          );
          // Best-effort TTL cleanup to avoid stale "running" states.
          window.setTimeout(() => {
            useExecApprovalsStore.setState(
              (s) => {
                const ts = s.runningByKey[runningKey];
                if (!ts) return s;
                if (Date.now() - ts < EXEC_RUNNING_TTL_MS) return s;
                const { [runningKey]: _ignored, ...rest } = s.runningByKey;
                return { ...s, runningByKey: rest };
              },
              false,
              "resolve/markRunning/ttl",
            );
          }, EXEC_RUNNING_TTL_MS + 1000);
        }

        set((s) => ({ busyById: { ...s.busyById, [id]: true } }), false, "resolve/busy");

        let resolvedAtMs = Date.now();
        let requestOk = false;
        try {
          await ipc.chat.request("exec.approval.resolve", { id, decision });
          requestOk = true;
          resolvedAtMs = Date.now();
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

        if (!requestOk) return;

        set(
          (s) => {
            const nextQueue = prune(s.queue).filter((x) => x.id !== id);

            let nextRunningByKey = s.runningByKey;
            if (decision === "deny" && runningKey && nextRunningByKey[runningKey]) {
              const { [runningKey]: _ignored, ...rest } = nextRunningByKey;
              nextRunningByKey = rest;
            }

            let nextLastResolved = s.lastResolvedBySession;
            if (sessionKey) {
              nextLastResolved = {
                ...s.lastResolvedBySession,
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
          "resolve/commit",
        );
      },
    }),
    { name: "ExecApprovalsStore" },
  ),
);

// Selectors
export const selectQueue = (state: ExecApprovalsStore) => state.queue;
export const selectBusyById = (state: ExecApprovalsStore) => state.busyById;
export const selectRunningByKey = (state: ExecApprovalsStore) => state.runningByKey;
export const selectLastResolvedBySession = (state: ExecApprovalsStore) =>
  state.lastResolvedBySession;

export function getPendingApprovalsForSession(
  queue: ExecApprovalRequest[],
  sessionKey: string | null | undefined,
): ExecApprovalRequest[] {
  const normalized = normalizeSessionKey(sessionKey);
  if (!normalized) return [];
  const active = prune(queue);
  const filtered = active.filter(
    (entry) => normalizeSessionKey(entry.request.sessionKey) === normalized,
  );
  return [...filtered].sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function selectPendingBySession(
  state: ExecApprovalsStore,
  sessionKey: string | null | undefined,
): ExecApprovalRequest[] {
  return getPendingApprovalsForSession(state.queue, sessionKey);
}

export function selectLatestBySession(
  state: ExecApprovalsStore,
  sessionKey: string | null | undefined,
): ExecApprovalRequest | null {
  return getPendingApprovalsForSession(state.queue, sessionKey)[0] ?? null;
}

export const execApprovalsSelectors = {
  selectQueue,
  selectBusyById,
  selectRunningByKey,
  selectLastResolvedBySession,
  selectPendingBySession,
  selectLatestBySession,
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
      useExecApprovalsStore.setState(
        (s) => {
          const currentQueue = prune(s.queue);
          const current = currentQueue.find((entry) => entry.id === resolved.id) ?? null;
          const nextQueue = currentQueue.filter((entry) => entry.id !== resolved.id);

          let nextRunningByKey = s.runningByKey;
          const command = current?.request.command?.trim() ?? "";
          const sessionKey = normalizeSessionKey(current?.request.sessionKey);
          if (resolved.decision === "deny" && command) {
            const runningKey = makeExecApprovalKey(sessionKey, command);
            if (nextRunningByKey[runningKey]) {
              const { [runningKey]: _ignored, ...rest } = nextRunningByKey;
              nextRunningByKey = rest;
            }
          }

          let nextLastResolved = s.lastResolvedBySession;
          if (sessionKey && resolved.decision) {
            nextLastResolved = {
              ...s.lastResolvedBySession,
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
        "listener/resolved",
      );
      return;
    }

    if (evt.event === "agent" && isRecord(evt.payload)) {
      const payload = evt.payload as Record<string, unknown>;
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
      if (!command) return;
      useExecApprovalsStore.getState().clearRunning(sessionKey, command);
    }
  });
}
