import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import { agentsLog } from "@/lib/logger";
import type { AgentsStore } from "../../store";
import type { CronJob, CronRunsEntry, CronStatus } from "../../types";

async function ensureChatConnected(): Promise<boolean> {
  const connected = await ipc.chat.isConnected();
  if (connected) return true;
  return await ipc.chat.connect();
}

export interface CronAction {
  loadCronStatus: () => Promise<void>;
  loadCronJobs: () => Promise<void>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<void>;
  runCronJob: (id: string) => Promise<void>;
  removeCronJob: (id: string) => Promise<void>;
  loadCronRuns: (jobId: string) => Promise<void>;
  clearCronError: () => void;
  clearCronRunsData: () => void;
}

export const cronSlice: StateCreator<AgentsStore, [["zustand/devtools", never]], [], CronAction> = (
  set,
  get,
) => ({
  loadCronStatus: async () => {
    try {
      const ok = await ensureChatConnected();
      if (!ok) return;
      const payload = (await ipc.chat.request("cron.status", {})) as CronStatus;
      set({ cronStatus: payload ?? null }, false, "loadCronStatus");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.status] failed:", message);
      set({ cronError: message }, false, "loadCronStatus/error");
    }
  },

  loadCronJobs: async () => {
    try {
      const ok = await ensureChatConnected();
      if (!ok) return;
      const payload = (await ipc.chat.request("cron.list", { includeDisabled: true })) as {
        jobs?: CronJob[];
      };
      set({ cronJobs: Array.isArray(payload?.jobs) ? payload.jobs : [] }, false, "loadCronJobs");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.list] failed:", message);
      set({ cronError: message }, false, "loadCronJobs/error");
    }
  },

  toggleCronJob: async (id, enabled) => {
    set({ cronBusyJobId: id }, false, "toggleCronJob/start");
    try {
      await ensureChatConnected();
      await ipc.chat.request("cron.update", { id, patch: { enabled } });
      await Promise.all([get().loadCronStatus(), get().loadCronJobs()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.toggle] failed:", message);
      set({ cronError: message }, false, "toggleCronJob/error");
    } finally {
      set({ cronBusyJobId: null }, false, "toggleCronJob/end");
    }
  },

  runCronJob: async (id) => {
    set({ cronBusyJobId: id }, false, "runCronJob/start");
    try {
      await ensureChatConnected();
      await ipc.chat.request("cron.run", { id, mode: "force" });
      await Promise.all([get().loadCronStatus(), get().loadCronJobs()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.run] failed:", message);
      set({ cronError: message }, false, "runCronJob/error");
    } finally {
      set({ cronBusyJobId: null }, false, "runCronJob/end");
    }
  },

  removeCronJob: async (id) => {
    set({ cronBusyJobId: id }, false, "removeCronJob/start");
    try {
      await ensureChatConnected();
      await ipc.chat.request("cron.remove", { id });
      await Promise.all([get().loadCronStatus(), get().loadCronJobs()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.remove] failed:", message);
      set({ cronError: message }, false, "removeCronJob/error");
    } finally {
      set({ cronBusyJobId: null }, false, "removeCronJob/end");
    }
  },

  loadCronRuns: async (jobId) => {
    set({ cronBusyJobId: jobId }, false, "loadCronRuns/start");
    try {
      await ensureChatConnected();
      const payload = (await ipc.chat.request("cron.runs", { id: jobId, limit: 50 })) as {
        entries?: CronRunsEntry[];
      };
      set(
        {
          cronRunsData: {
            jobId,
            entries: Array.isArray(payload?.entries) ? payload.entries : [],
          },
        },
        false,
        "loadCronRuns",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[cron.runs] failed:", message);
      set({ cronError: message }, false, "loadCronRuns/error");
    } finally {
      set({ cronBusyJobId: null }, false, "loadCronRuns/end");
    }
  },

  clearCronError: () => {
    set({ cronError: null }, false, "clearCronError");
  },

  clearCronRunsData: () => {
    set({ cronRunsData: null }, false, "clearCronRunsData");
  },
});
