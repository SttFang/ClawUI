import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig, SkillsListResult } from "@/lib/ipc";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  configGetSnapshot: vi.fn<() => Promise<{ config: unknown }>>(),
  skillsList: vi.fn<() => Promise<SkillsListResult>>(),
  chatRequest: vi.fn<(method: string, params?: Record<string, unknown>) => Promise<unknown>>(),
  chatIsConnected: vi.fn<() => Promise<boolean>>(),
  chatConnect: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: { getSnapshot: mocks.configGetSnapshot },
    skills: { list: mocks.skillsList },
    chat: {
      request: mocks.chatRequest,
      isConnected: mocks.chatIsConnected,
      connect: mocks.chatConnect,
    },
  },
}));

vi.mock("@/services/chat/connection", () => ({
  ensureChatConnected: async () => {
    const connected = await mocks.chatIsConnected();
    if (connected) return;
    const ok = await mocks.chatConnect();
    if (!ok) throw new Error("Gateway WebSocket unavailable");
  },
}));

// Must import after vi.mock
const { useAgentsStore } = await import("../store");
const { initialState } = await import("../initialState");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeConfig = {
  agents: {
    defaults: {
      model: { primary: "gpt-4", fallbacks: ["gpt-3.5"] },
      workspace: "/tmp/ws",
      sandbox: { enabled: false },
    },
  },
} as unknown as OpenClawConfig;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe("AgentsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentsStore.setState(initialState);
    // Default: chat is connected
    mocks.chatIsConnected.mockResolvedValue(true);
    mocks.chatConnect.mockResolvedValue(true);
  });

  // =========================================================================
  // CRUD slice
  // =========================================================================
  describe("crud", () => {
    it("listAgents derives agents from config", () => {
      useAgentsStore.setState({ config: fakeConfig as never });
      useAgentsStore.getState().listAgents();
      const agents = useAgentsStore.getState().agents;
      expect(agents).toHaveLength(1);
      expect(agents[0]).toEqual({
        id: "main",
        modelPrimary: "gpt-4",
        modelFallbacks: ["gpt-3.5"],
        workspace: "/tmp/ws",
      });
    });

    it("listAgents returns empty when config is null", () => {
      useAgentsStore.getState().listAgents();
      expect(useAgentsStore.getState().agents).toEqual([]);
    });

    it("selectAgent updates selectedAgentId", () => {
      useAgentsStore.getState().selectAgent("custom-agent");
      expect(useAgentsStore.getState().selectedAgentId).toBe("custom-agent");
    });
  });

  // =========================================================================
  // Config slice
  // =========================================================================
  describe("config", () => {
    it("loadConfig stores config and triggers listAgents", async () => {
      mocks.configGetSnapshot.mockResolvedValue({ config: fakeConfig });
      await useAgentsStore.getState().loadConfig();
      const s = useAgentsStore.getState();
      expect(s.config).toEqual(fakeConfig);
      expect(s.configError).toBeNull();
      expect(s.agents).toHaveLength(1);
    });

    it("loadConfig sets configError on failure", async () => {
      mocks.configGetSnapshot.mockRejectedValue(new Error("boom"));
      await useAgentsStore.getState().loadConfig();
      expect(useAgentsStore.getState().configError).toBe("boom");
    });

    it("loadSkills stores skills list", async () => {
      const skills: SkillsListResult = {
        skills: [{ name: "s1", description: "d1", source: "local" }],
      };
      mocks.skillsList.mockResolvedValue(skills);
      await useAgentsStore.getState().loadSkills();
      expect(useAgentsStore.getState().skills).toEqual(skills);
      expect(useAgentsStore.getState().skillsError).toBeNull();
    });

    it("loadSkills sets skillsError on failure", async () => {
      mocks.skillsList.mockRejectedValue(new Error("no skills"));
      await useAgentsStore.getState().loadSkills();
      expect(useAgentsStore.getState().skillsError).toBe("no skills");
    });
  });

  // =========================================================================
  // Cron slice
  // =========================================================================
  describe("cron", () => {
    it("loadCronStatus stores status", async () => {
      const status = { enabled: true, jobs: 3, nextWakeAtMs: 1000 };
      mocks.chatRequest.mockResolvedValue(status);
      await useAgentsStore.getState().loadCronStatus();
      expect(useAgentsStore.getState().cronStatus).toEqual(status);
    });

    it("loadCronStatus sets cronError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("timeout"));
      await useAgentsStore.getState().loadCronStatus();
      expect(useAgentsStore.getState().cronError).toBe("timeout");
    });

    it("loadCronStatus skips when chat not connected", async () => {
      mocks.chatIsConnected.mockResolvedValue(false);
      mocks.chatConnect.mockResolvedValue(false);
      await useAgentsStore.getState().loadCronStatus();
      expect(mocks.chatRequest).not.toHaveBeenCalled();
      expect(useAgentsStore.getState().cronStatus).toBeNull();
    });

    it("loadCronJobs stores jobs array", async () => {
      const jobs = [{ id: "j1", name: "daily", enabled: true }];
      mocks.chatRequest.mockResolvedValue({ jobs });
      await useAgentsStore.getState().loadCronJobs();
      expect(useAgentsStore.getState().cronJobs).toEqual(jobs);
    });

    it("loadCronJobs defaults to empty array when payload has no jobs", async () => {
      mocks.chatRequest.mockResolvedValue({});
      await useAgentsStore.getState().loadCronJobs();
      expect(useAgentsStore.getState().cronJobs).toEqual([]);
    });

    it("toggleCronJob sends update and refreshes", async () => {
      mocks.chatRequest.mockResolvedValue({});
      await useAgentsStore.getState().toggleCronJob("j1", false);
      expect(mocks.chatRequest).toHaveBeenCalledWith("cron.update", {
        id: "j1",
        patch: { enabled: false },
      });
      // busy flag cleared
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("toggleCronJob sets cronError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("fail"));
      await useAgentsStore.getState().toggleCronJob("j1", true);
      expect(useAgentsStore.getState().cronError).toBe("fail");
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("runCronJob sends force run and refreshes", async () => {
      mocks.chatRequest.mockResolvedValue({});
      await useAgentsStore.getState().runCronJob("j1");
      expect(mocks.chatRequest).toHaveBeenCalledWith("cron.run", {
        id: "j1",
        mode: "force",
      });
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("removeCronJob sends remove and refreshes", async () => {
      mocks.chatRequest.mockResolvedValue({});
      await useAgentsStore.getState().removeCronJob("j1");
      expect(mocks.chatRequest).toHaveBeenCalledWith("cron.remove", { id: "j1" });
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("removeCronJob sets cronError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("denied"));
      await useAgentsStore.getState().removeCronJob("j1");
      expect(useAgentsStore.getState().cronError).toBe("denied");
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("loadCronRuns stores entries for a job", async () => {
      const entries = [{ ts: 1, jobId: "j1", status: "ok" as const }];
      mocks.chatRequest.mockResolvedValue({ entries });
      await useAgentsStore.getState().loadCronRuns("j1");
      expect(useAgentsStore.getState().cronRunsData).toEqual({
        jobId: "j1",
        entries,
      });
      expect(useAgentsStore.getState().cronBusyJobId).toBeNull();
    });

    it("clearCronError resets cronError", () => {
      useAgentsStore.setState({ cronError: "old" });
      useAgentsStore.getState().clearCronError();
      expect(useAgentsStore.getState().cronError).toBeNull();
    });

    it("clearCronRunsData resets cronRunsData", () => {
      useAgentsStore.setState({
        cronRunsData: { jobId: "j1", entries: [] },
      });
      useAgentsStore.getState().clearCronRunsData();
      expect(useAgentsStore.getState().cronRunsData).toBeNull();
    });
  });

  // =========================================================================
  // Nodes slice
  // =========================================================================
  describe("nodes", () => {
    it("loadNodes stores node list", async () => {
      const nodes = [{ nodeId: "n1", displayName: "Node 1" }];
      mocks.chatRequest.mockResolvedValue({ nodes });
      await useAgentsStore.getState().loadNodes();
      const s = useAgentsStore.getState();
      expect(s.nodes).toEqual(nodes);
      expect(s.nodesError).toBeNull();
      expect(s.nodesLoading).toBe(false);
    });

    it("loadNodes sets nodesError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("net err"));
      await useAgentsStore.getState().loadNodes();
      expect(useAgentsStore.getState().nodesError).toBe("net err");
      expect(useAgentsStore.getState().nodesLoading).toBe(false);
    });

    it("loadPendingNodes stores pending list", async () => {
      const requests = [{ requestId: "r1", displayName: "Pending 1" }];
      mocks.chatRequest.mockResolvedValue({ requests });
      await useAgentsStore.getState().loadPendingNodes();
      expect(useAgentsStore.getState().pendingNodes).toEqual(requests);
    });

    it("approveNode refreshes both nodes and pending", async () => {
      const nodes = [{ nodeId: "n1" }];
      const requests = [{ requestId: "r2" }];
      mocks.chatRequest
        .mockResolvedValueOnce(undefined) // approve call
        .mockResolvedValueOnce({ nodes }) // node.list
        .mockResolvedValueOnce({ requests }); // node.pair.list
      await useAgentsStore.getState().approveNode("r1");
      expect(mocks.chatRequest).toHaveBeenCalledWith("node.pair.approve", {
        requestId: "r1",
      });
      expect(useAgentsStore.getState().nodes).toEqual(nodes);
      expect(useAgentsStore.getState().pendingNodes).toEqual(requests);
    });

    it("approveNode sets nodesError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("denied"));
      await useAgentsStore.getState().approveNode("r1");
      expect(useAgentsStore.getState().nodesError).toBe("denied");
    });

    it("rejectNode refreshes pending list", async () => {
      const requests = [{ requestId: "r3" }];
      mocks.chatRequest
        .mockResolvedValueOnce(undefined) // reject call
        .mockResolvedValueOnce({ requests }); // node.pair.list
      await useAgentsStore.getState().rejectNode("r1");
      expect(mocks.chatRequest).toHaveBeenCalledWith("node.pair.reject", {
        requestId: "r1",
      });
      expect(useAgentsStore.getState().pendingNodes).toEqual(requests);
    });

    it("rejectNode sets nodesError on failure", async () => {
      mocks.chatRequest.mockRejectedValue(new Error("reject fail"));
      await useAgentsStore.getState().rejectNode("r1");
      expect(useAgentsStore.getState().nodesError).toBe("reject fail");
    });
  });
});
