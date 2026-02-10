import type { Session } from "../../initialState";

export interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
}

export const initialSessionState: SessionState = {
  sessions: [],
  currentSessionId: null,
};
