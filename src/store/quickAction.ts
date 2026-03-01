import { create } from "zustand";

interface QuickActionState {
  pendingInsert: string | null;
  autoSend: boolean;
  insertToChat: (text: string, options?: { autoSend?: boolean }) => void;
  consume: () => { text: string | null; autoSend: boolean };
}

export const useQuickActionStore = create<QuickActionState>((set, get) => ({
  pendingInsert: null,
  autoSend: false,
  insertToChat: (text, options) =>
    set({ pendingInsert: text, autoSend: options?.autoSend ?? false }),
  consume: () => {
    const { pendingInsert, autoSend } = get();
    set({ pendingInsert: null, autoSend: false });
    return { text: pendingInsert, autoSend };
  },
}));
