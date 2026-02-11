import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, type ChatNormalizedRunEvent } from "@/lib/ipc";

type ChatRunRecord = {
  traceId: string;
  sessionKey: string;
  clientRunId: string;
  agentRunId?: string;
  status?: string;
  lastEventKind: ChatNormalizedRunEvent["kind"];
  lastEventAtMs: number;
  lastText?: string;
  lastError?: string;
  lastApprovalId?: string;
  lastDecision?: "allow-once" | "allow-always" | "deny";
};

type ChatRunsState = {
  runsByTraceId: Record<string, ChatRunRecord>;
  latestTraceBySession: Record<string, string>;
  recentEvents: ChatNormalizedRunEvent[];
};

type ChatRunsActions = {
  ingest: (event: ChatNormalizedRunEvent) => void;
  clearSession: (sessionKey: string) => void;
};

type ChatRunsStore = ChatRunsState & ChatRunsActions;

const MAX_RECENT_EVENTS = 100;

function isTerminal(kind: ChatNormalizedRunEvent["kind"]): boolean {
  return kind === "run.completed" || kind === "run.failed" || kind === "run.aborted";
}

function shouldIgnoreRegression(
  current: ChatRunRecord | undefined,
  incoming: ChatNormalizedRunEvent,
): boolean {
  if (!current) return false;
  if (!isTerminal(current.lastEventKind)) return false;
  return !isTerminal(incoming.kind);
}

export const useChatRunsStore = create<ChatRunsStore>()(
  devtools(
    (set) => ({
      runsByTraceId: {},
      latestTraceBySession: {},
      recentEvents: [],

      ingest: (event) =>
        set(
          (state) => {
            const current = state.runsByTraceId[event.traceId];
            if (shouldIgnoreRegression(current, event)) return state;

            const nextRecord: ChatRunRecord = {
              traceId: event.traceId,
              sessionKey: event.sessionKey,
              clientRunId: event.clientRunId,
              agentRunId: event.agentRunId,
              status: event.status,
              lastEventKind: event.kind,
              lastEventAtMs: event.timestampMs,
              lastText: event.text,
              lastError: event.error,
              lastApprovalId: event.approvalId,
              lastDecision: event.decision,
            };

            const nextRecent = [...state.recentEvents, event].slice(-MAX_RECENT_EVENTS);
            return {
              runsByTraceId: {
                ...state.runsByTraceId,
                [event.traceId]: nextRecord,
              },
              latestTraceBySession: {
                ...state.latestTraceBySession,
                [event.sessionKey]: event.traceId,
              },
              recentEvents: nextRecent,
            };
          },
          false,
          "chatRuns/ingest",
        ),

      clearSession: (sessionKey) =>
        set(
          (state) => {
            const normalized = sessionKey.trim();
            if (!normalized) return state;

            const nextRuns = Object.fromEntries(
              Object.entries(state.runsByTraceId).filter(
                ([, record]) => record.sessionKey !== normalized,
              ),
            );
            const nextLatest = { ...state.latestTraceBySession };
            delete nextLatest[normalized];
            const nextRecent = state.recentEvents.filter((evt) => evt.sessionKey !== normalized);
            return {
              runsByTraceId: nextRuns,
              latestTraceBySession: nextLatest,
              recentEvents: nextRecent,
            };
          },
          false,
          "chatRuns/clearSession",
        ),
    }),
    { name: "ChatRunsStore" },
  ),
);

let chatRunsListenerInitialized = false;
export function initChatRunsListener() {
  if (chatRunsListenerInitialized || typeof window === "undefined") return;
  chatRunsListenerInitialized = true;
  ipc.chat.onNormalizedEvent((event) => {
    useChatRunsStore.getState().ingest(event);
  });
}
