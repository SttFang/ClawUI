import type { Session } from "../../initialState";

export interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  sessionsInitialized: boolean;
}

export const initialSessionState: SessionState = {
  sessions: [],
  currentSessionId: null,
  sessionsInitialized: false,
};
