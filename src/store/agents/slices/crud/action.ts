import type { StateCreator } from "zustand";
import type { OpenClawConfig } from "@/lib/ipc";
import type { AgentsStore } from "../../store";
import type { Agent } from "../../types";

function toAgentViews(config: OpenClawConfig | null): Agent[] {
  if (!config) return [];
  const defaults = config.agents?.defaults;
  return [
    {
      id: "main",
      modelPrimary: defaults?.model?.primary ?? null,
      modelFallbacks: defaults?.model?.fallbacks ?? [],
      workspace: defaults?.workspace ?? null,
    },
  ];
}

export interface CrudAction {
  listAgents: () => void;
  selectAgent: (id: string) => void;
}

export const crudSlice: StateCreator<AgentsStore, [["zustand/devtools", never]], [], CrudAction> = (
  set,
  get,
) => ({
  listAgents: () => {
    const agents = toAgentViews(get().config);
    set({ agents }, false, "listAgents");
  },

  selectAgent: (id) => {
    set({ selectedAgentId: id }, false, "selectAgent");
  },
});
