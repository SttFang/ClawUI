import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface CompactionState {
  /** sessionKey → compacting */
  sessions: Record<string, boolean>;
}

interface CompactionActions {
  setCompacting: (sessionKey: string, compacting: boolean) => void;
}

type CompactionStore = CompactionState & CompactionActions;

export const useCompactionStore = create<CompactionStore>()(
  devtools(
    (set) => ({
      sessions: {},
      setCompacting: (sessionKey, compacting) =>
        set(
          (s) => ({ sessions: { ...s.sessions, [sessionKey]: compacting } }),
          false,
          "compaction/setCompacting",
        ),
    }),
    { name: "CompactionStore" },
  ),
);

export const selectIsCompacting = (sessionKey: string) => (s: CompactionStore) =>
  s.sessions[sessionKey] ?? false;
