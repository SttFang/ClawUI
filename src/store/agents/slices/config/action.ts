import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import { agentsLog } from "@/lib/logger";
import type { AgentsStore } from "../../store";

export interface ConfigAction {
  loadConfig: () => Promise<void>;
  loadSkills: () => Promise<void>;
  internal_refreshConfig: () => Promise<void>;
}

export const configSlice: StateCreator<
  AgentsStore,
  [["zustand/devtools", never]],
  [],
  ConfigAction
> = (set, get) => ({
  loadConfig: async () => {
    try {
      const cfg = (await ipc.config.get()) ?? null;
      set({ config: cfg, configError: null }, false, "loadConfig");
      get().listAgents();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[config.load] failed:", message);
      set({ configError: message }, false, "loadConfig/error");
    }
  },

  loadSkills: async () => {
    try {
      const res = await ipc.skills.list();
      set({ skills: res, skillsError: null }, false, "loadSkills");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[skills.load] failed:", message);
      set({ skillsError: message }, false, "loadSkills/error");
    }
  },

  internal_refreshConfig: async () => {
    await get().loadConfig();
    get().listAgents();
  },
});
