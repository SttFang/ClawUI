import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import { chatLog } from "@/lib/logger";
import type { Session } from "../../initialState";
import type { ChatStore } from "../../store";
import {
  generateUiSessionKey,
  isMainSessionKey,
  MAIN_SESSION_KEY,
  parseSessionsListPayload,
} from "../../helpers";

export interface SessionAction {
  refreshSessions: () => Promise<void>;
  createSession: (name?: string) => string;
  selectSession: (id: string | null) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  clearCurrentSession: () => void;
}

export const sessionSlice: StateCreator<
  ChatStore,
  [["zustand/devtools", never]],
  [],
  SessionAction
> = (set, get) => ({
  refreshSessions: async () => {
    try {
      const payload = await ipc.chat.request("sessions.list", {
        limit: 50,
        includeDerivedTitles: true,
        includeLastMessage: true,
      });

      const sessions = parseSessionsListPayload(payload);
      if (sessions.length === 0) return;

      const prevById = new Map(get().sessions.map((s) => [s.id, s]));
      const merged = sessions.map((remote, idx) => {
        const prev = prevById.get(remote.id);
        if (prev) {
          return {
            ...prev,
            name: remote.name,
            updatedAt: remote.updatedAt,
            surface: remote.surface ?? prev.surface ?? null,
          };
        }
        return {
          ...remote,
          name: remote.name || `Session ${idx + 1}`,
          messages: [],
        } satisfies Session;
      });

      set(
        (state) => ({
          sessions: merged,
          currentSessionId: state.currentSessionId ?? merged[0]?.id ?? null,
        }),
        false,
        "refreshSessions",
      );
    } catch (error) {
      chatLog.warn("Failed to refresh sessions from gateway:", error);
    }
  },

  createSession: (name) => {
    const hasMain = get().sessions.some((s) => isMainSessionKey(s.id));
    const id = hasMain ? generateUiSessionKey() : MAIN_SESSION_KEY;
    const now = Date.now();
    const session: Session = {
      id,
      name: name || `Session ${get().sessions.length + 1}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set(
      (state) => ({
        sessions: [...state.sessions, session],
        currentSessionId: id,
      }),
      false,
      "createSession",
    );
    return id;
  },

  selectSession: (id) => set({ currentSessionId: id }, false, "selectSession"),

  deleteSession: (id) =>
    set(
      (state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      }),
      false,
      "deleteSession",
    ),

  renameSession: (id, name) =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, name, updatedAt: Date.now() } : s,
        ),
      }),
      false,
      "renameSession",
    ),

  clearCurrentSession: () =>
    set(
      (state) => ({
        sessions: state.sessions.map((s) =>
          s.id === state.currentSessionId ? { ...s, messages: [], updatedAt: Date.now() } : s,
        ),
      }),
      false,
      "clearCurrentSession",
    ),
});
