import type { StateCreator } from "zustand";
import { ipc } from "@/lib/ipc";
import { agentsLog } from "@/lib/logger";
import type { AgentsStore } from "../../store";
import type { NodeInfo, PendingNode } from "../../types";

export interface NodesAction {
  loadNodes: () => Promise<void>;
  loadPendingNodes: () => Promise<void>;
  approveNode: (requestId: string) => Promise<void>;
  rejectNode: (requestId: string) => Promise<void>;
}

export const nodesSlice: StateCreator<
  AgentsStore,
  [["zustand/devtools", never]],
  [],
  NodesAction
> = (set) => ({
  loadNodes: async () => {
    set({ nodesLoading: true }, false, "loadNodes/start");
    try {
      const res = (await ipc.chat.request("nodes", { action: "status" })) as {
        nodes?: NodeInfo[];
      };
      set({ nodes: res?.nodes ?? [], nodesError: null, nodesLoading: false }, false, "loadNodes");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[nodes.load] failed:", message);
      set({ nodesError: message, nodesLoading: false }, false, "loadNodes/error");
    }
  },

  loadPendingNodes: async () => {
    try {
      const res = (await ipc.chat.request("nodes", { action: "pending" })) as {
        requests?: PendingNode[];
      };
      set({ pendingNodes: res?.requests ?? [] }, false, "loadPendingNodes");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[nodes.pending] failed:", message);
    }
  },

  approveNode: async (requestId) => {
    try {
      await ipc.chat.request("nodes", { action: "approve", requestId });
      // Refresh both lists
      const [statusRes, pendingRes] = await Promise.all([
        ipc.chat.request("nodes", { action: "status" }) as Promise<{ nodes?: NodeInfo[] }>,
        ipc.chat.request("nodes", { action: "pending" }) as Promise<{ requests?: PendingNode[] }>,
      ]);
      set(
        { nodes: statusRes?.nodes ?? [], pendingNodes: pendingRes?.requests ?? [] },
        false,
        "approveNode",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[nodes.approve] failed:", message);
      set({ nodesError: message }, false, "approveNode/error");
    }
  },

  rejectNode: async (requestId) => {
    try {
      await ipc.chat.request("nodes", { action: "reject", requestId });
      const res = (await ipc.chat.request("nodes", { action: "pending" })) as {
        requests?: PendingNode[];
      };
      set({ pendingNodes: res?.requests ?? [] }, false, "rejectNode");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      agentsLog.warn("[nodes.reject] failed:", message);
      set({ nodesError: message }, false, "rejectNode/error");
    }
  },
});
