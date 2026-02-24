import type { StateCreator } from "zustand";
import type { OpenClawConfig } from "@/lib/ipc";
import type { AgentsStore } from "../../store";
import type { Agent } from "../../types";

interface AgentListEntry {
  id: string;
  name?: string;
  workspace?: string;
  model?: { primary?: string; fallbacks?: string[] };
  identity?: { name?: string; emoji?: string };
}

function toAgentViews(config: OpenClawConfig | null): Agent[] {
  if (!config) return [];
  const defaults = config.agents?.defaults;
  const list = (config.agents as Record<string, unknown> | undefined)?.list as
    | AgentListEntry[]
    | undefined;

  if (!Array.isArray(list) || list.length === 0) {
    return [
      {
        id: "main",
        modelPrimary: defaults?.model?.primary ?? null,
        modelFallbacks: defaults?.model?.fallbacks ?? [],
        workspace: defaults?.workspace ?? null,
      },
    ];
  }

  return list.map((entry) => ({
    id: entry.id,
    name: entry.identity?.name ?? entry.name,
    emoji: entry.identity?.emoji,
    modelPrimary: entry.model?.primary ?? defaults?.model?.primary ?? null,
    modelFallbacks: entry.model?.fallbacks ?? defaults?.model?.fallbacks ?? [],
    workspace: entry.workspace ?? defaults?.workspace ?? null,
  }));
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
