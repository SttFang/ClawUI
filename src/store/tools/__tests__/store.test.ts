import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useToolsStore, type Tool } from "../index";

const mockDraft = vi.hoisted(() => ({
  applyPatch: vi.fn<(patch: unknown) => Promise<void>>(async () => {}),
}));

const mockToolsLog = vi.hoisted(() => ({
  error: vi.fn<(message: string, error: unknown) => void>(() => {}),
}));

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      getSnapshot: vi.fn(),
    },
  },
}));

vi.mock("@/store/configDraft", () => ({
  useConfigDraftStore: {
    getState: () => ({
      applyPatch: mockDraft.applyPatch,
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  toolsLog: {
    error: mockToolsLog.error,
  },
}));

type ToolsPersistPatch = {
  tools?: {
    allow?: string[];
    deny?: string[];
    exec?: {
      host?: string;
      ask?: string;
      security?: string;
    };
  };
  agents?: {
    defaults?: {
      sandbox?: {
        mode?: string;
      };
    };
  };
};

const defaultTools: Tool[] = [
  {
    id: "group:fs",
    name: "File Operations",
    description: "Read, write, and manage files on the system",
    category: "filesystem",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "group:web",
    name: "Web Operations",
    description: "Browse websites and fetch web content",
    category: "group:web",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "group:runtime",
    name: "Runtime Operations",
    description: "Execute shell commands and scripts",
    category: "command",
    enabled: true,
    requiresConfirmation: true,
  },
  {
    id: "group:sessions",
    name: "Session Operations",
    description: "Query and manage database connections",
    category: "group:sessions",
    enabled: false,
    requiresConfirmation: true,
  },
  {
    id: "group:memory",
    name: "Memory Operations",
    description: "Process images, audio, and video files",
    category: "group:memory",
    enabled: false,
    requiresConfirmation: false,
  },
];

const initialState = {
  tools: defaultTools,
  config: {
    accessMode: "auto" as const,
    allowList: [] as string[],
    denyList: [] as string[],
    sandboxEnabled: true,
    execHost: "sandbox" as const,
    execAsk: "on-miss" as const,
    execSecurity: "deny" as const,
  },
  isLoading: false,
  error: null,
};

function getLastPersistPatch() {
  const call = mockDraft.applyPatch.mock.calls.at(-1);
  expect(call).toBeDefined();
  if (!call) throw new Error("missing applyPatch call");
  return call[0] as ToolsPersistPatch;
}

describe("ToolsStore", () => {
  beforeEach(() => {
    useToolsStore.setState({
      ...initialState,
      tools: JSON.parse(JSON.stringify(defaultTools)) as Tool[],
      config: {
        ...initialState.config,
        allowList: [],
        denyList: [],
      },
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("loadTools", () => {
    it("should load tools config from IPC", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        config: {
          tools: {
            allow: ["group:fs", "group:web"],
            deny: ["group:sessions"],
            exec: { host: "gateway", ask: "always", security: "allowlist" },
          },
          agents: {
            defaults: {
              sandbox: { mode: "off" },
            },
          },
        },
      });

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      expect(state.config.accessMode).toBe("ask");
      expect(state.config.allowList).toEqual(["group:fs", "group:web"]);
      expect(state.config.denyList).toEqual(["group:sessions"]);
      expect(state.config.sandboxEnabled).toBe(false);
      expect(state.config.execHost).toBe("gateway");
      expect(state.config.execAsk).toBe("always");
      expect(state.config.execSecurity).toBe("allowlist");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should update tools enabled status based on deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        config: {
          tools: {
            allow: [],
            deny: ["group:fs", "group:web"],
            exec: { host: "gateway", ask: "on-miss", security: "allowlist" },
          },
        },
      });

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      const fsTool = state.tools.find((t) => t.id === "group:fs");
      const webTool = state.tools.find((t) => t.id === "group:web");

      expect(fsTool?.enabled).toBe(false);
      expect(webTool?.enabled).toBe(false);
    });

    it("should enable tools in allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        config: {
          tools: {
            allow: ["group:sessions", "group:memory"],
            deny: [],
            exec: { host: "gateway", ask: "on-miss", security: "allowlist" },
          },
        },
      });

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      const dbTool = state.tools.find((t) => t.id === "group:sessions");
      const mediaTool = state.tools.find((t) => t.id === "group:memory");

      expect(dbTool?.enabled).toBe(true);
      expect(mediaTool?.enabled).toBe(true);
    });

    it("should handle null config", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        config: null,
      });

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle config without tools", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        config: {},
      });

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should handle load error", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.getSnapshot as Mock).mockRejectedValue(new Error("Config load failed"));

      await useToolsStore.getState().loadTools();

      const state = useToolsStore.getState();
      expect(state.error).toBe("Config load failed");
      expect(state.isLoading).toBe(false);
    });

    it("should set loading state during load", async () => {
      const { ipc } = await import("@/lib/ipc");
      let capturedLoading = false;

      (ipc.config.getSnapshot as Mock).mockImplementation(() => {
        capturedLoading = useToolsStore.getState().isLoading;
        return Promise.resolve({ config: {} });
      });

      await useToolsStore.getState().loadTools();

      expect(capturedLoading).toBe(true);
    });
  });

  describe("setAccessMode", () => {
    it("should update access mode to auto", async () => {
      await useToolsStore.getState().setAccessMode("auto");
      expect(useToolsStore.getState().config.accessMode).toBe("auto");
    });

    it("should update access mode to ask", async () => {
      await useToolsStore.getState().setAccessMode("ask");
      expect(useToolsStore.getState().config.accessMode).toBe("ask");
    });

    it("should update access mode to deny", async () => {
      await useToolsStore.getState().setAccessMode("deny");
      expect(useToolsStore.getState().config.accessMode).toBe("deny");
    });

    it("should persist to config", async () => {
      await useToolsStore.getState().setAccessMode("ask");

      expect(mockDraft.applyPatch).toHaveBeenCalledTimes(1);
      const patch = getLastPersistPatch();

      expect(patch.tools?.exec?.ask).toBe("always");
      expect(patch.tools?.exec?.security).toBe("allowlist");
      expect(patch.tools?.deny).toEqual([]);
      expect(patch.tools?.allow).toEqual([]);
      expect(patch.agents?.defaults?.sandbox?.mode).toBe("non-main");
    });

    it("should handle save error gracefully", async () => {
      mockDraft.applyPatch.mockRejectedValueOnce(new Error("Save failed"));

      await useToolsStore.getState().setAccessMode("deny");

      const state = useToolsStore.getState();
      expect(state.config.accessMode).toBe("auto"); // rolled back
      expect(state.error).toBe("Save failed");
      expect(mockToolsLog.error).toHaveBeenCalledWith(
        "Failed to save access mode:",
        expect.any(Error),
      );
    });

    it("should map deny mode to deny/off", async () => {
      await useToolsStore.getState().setAccessMode("deny");
      const state = useToolsStore.getState();
      expect(state.config.execAsk).toBe("off");
      expect(state.config.execSecurity).toBe("deny");
    });
  });

  describe("exec settings", () => {
    it("setExecHost should persist host", async () => {
      await useToolsStore.getState().setExecHost("gateway");

      const state = useToolsStore.getState();
      expect(state.config.execHost).toBe("gateway");
      const patch = getLastPersistPatch();
      expect(patch.tools?.exec?.host).toBe("gateway");
    });

    it("setExecAsk should update access mode", async () => {
      await useToolsStore.getState().setExecAsk("always");
      expect(useToolsStore.getState().config.accessMode).toBe("ask");
    });

    it("setExecSecurity should update access mode", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, execAsk: "off", execSecurity: "allowlist" },
      });
      await useToolsStore.getState().setExecSecurity("deny");
      expect(useToolsStore.getState().config.accessMode).toBe("deny");
    });
  });

  describe("setPolicyLists", () => {
    it("should replace allow/deny lists", async () => {
      await useToolsStore.getState().setPolicyLists({
        allowList: ["group:runtime"],
        denyList: ["exec"],
      });

      const state = useToolsStore.getState();
      expect(state.config.allowList).toEqual(["group:runtime"]);
      expect(state.config.denyList).toEqual(["exec"]);
      const patch = getLastPersistPatch();
      expect(patch.tools?.allow).toEqual(["group:runtime"]);
      expect(patch.tools?.deny).toEqual(["exec"]);
    });
  });

  describe("enableTool", () => {
    it("should enable a tool", async () => {
      await useToolsStore.getState().enableTool("group:sessions");

      const state = useToolsStore.getState();
      const dbTool = state.tools.find((t) => t.id === "group:sessions");
      expect(dbTool?.enabled).toBe(true);
    });

    it("should add tool to allow list", async () => {
      await useToolsStore.getState().enableTool("group:sessions");
      expect(useToolsStore.getState().config.allowList).toContain("group:sessions");
    });

    it("should remove tool from deny list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["group:sessions", "group:memory"] },
      });

      await useToolsStore.getState().enableTool("group:sessions");

      const state = useToolsStore.getState();
      expect(state.config.denyList).not.toContain("group:sessions");
      expect(state.config.denyList).toContain("group:memory");
    });

    it("should not duplicate in allow list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["group:sessions"] },
      });

      await useToolsStore.getState().enableTool("group:sessions");

      const allowList = useToolsStore.getState().config.allowList;
      expect(allowList.filter((id) => id === "group:sessions")).toHaveLength(1);
    });

    it("should persist config", async () => {
      await useToolsStore.getState().enableTool("group:sessions");

      expect(mockDraft.applyPatch).toHaveBeenCalledTimes(1);
      const patch = getLastPersistPatch();
      expect(patch.tools?.allow).toEqual(expect.arrayContaining(["group:sessions"]));
      expect(patch.tools?.deny).not.toContain("group:sessions");
    });
  });

  describe("disableTool", () => {
    it("should disable a tool", async () => {
      await useToolsStore.getState().disableTool("group:fs");

      const state = useToolsStore.getState();
      const fsTool = state.tools.find((t) => t.id === "group:fs");
      expect(fsTool?.enabled).toBe(false);
    });

    it("should add tool to deny list", async () => {
      await useToolsStore.getState().disableTool("group:fs");
      expect(useToolsStore.getState().config.denyList).toContain("group:fs");
    });

    it("should remove tool from allow list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["group:fs", "group:web"] },
      });

      await useToolsStore.getState().disableTool("group:fs");

      const state = useToolsStore.getState();
      expect(state.config.allowList).not.toContain("group:fs");
      expect(state.config.allowList).toContain("group:web");
    });

    it("should not duplicate in deny list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["group:fs"] },
      });

      await useToolsStore.getState().disableTool("group:fs");

      const denyList = useToolsStore.getState().config.denyList;
      expect(denyList.filter((id) => id === "group:fs")).toHaveLength(1);
    });
  });

  describe("toggleSandbox", () => {
    it("should enable sandbox", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, sandboxEnabled: false },
      });

      await useToolsStore.getState().toggleSandbox(true);
      expect(useToolsStore.getState().config.sandboxEnabled).toBe(true);
    });

    it("should disable sandbox", async () => {
      await useToolsStore.getState().toggleSandbox(false);
      expect(useToolsStore.getState().config.sandboxEnabled).toBe(false);
    });

    it("should persist config", async () => {
      await useToolsStore.getState().toggleSandbox(false);

      expect(mockDraft.applyPatch).toHaveBeenCalledTimes(1);
      const patch = getLastPersistPatch();
      expect(patch.agents?.defaults?.sandbox?.mode).toBe("off");
    });
  });

  describe("addToAllowList", () => {
    it("should add tool to allow list", async () => {
      await useToolsStore.getState().addToAllowList("group:sessions");
      expect(useToolsStore.getState().config.allowList).toContain("group:sessions");
    });

    it("should remove from deny list if present", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["group:sessions"] },
      });

      await useToolsStore.getState().addToAllowList("group:sessions");

      const state = useToolsStore.getState();
      expect(state.config.allowList).toContain("group:sessions");
      expect(state.config.denyList).not.toContain("group:sessions");
    });

    it("should not add if already in allow list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["group:sessions"] },
      });

      await useToolsStore.getState().addToAllowList("group:sessions");
      expect(mockDraft.applyPatch).not.toHaveBeenCalled();
    });
  });

  describe("addToDenyList", () => {
    it("should add tool to deny list", async () => {
      await useToolsStore.getState().addToDenyList("group:fs");
      expect(useToolsStore.getState().config.denyList).toContain("group:fs");
    });

    it("should remove from allow list if present", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["group:fs"] },
      });

      await useToolsStore.getState().addToDenyList("group:fs");

      const state = useToolsStore.getState();
      expect(state.config.denyList).toContain("group:fs");
      expect(state.config.allowList).not.toContain("group:fs");
    });

    it("should not add if already in deny list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["group:fs"] },
      });

      await useToolsStore.getState().addToDenyList("group:fs");
      expect(mockDraft.applyPatch).not.toHaveBeenCalled();
    });
  });

  describe("removeFromAllowList", () => {
    it("should remove tool from allow list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["group:fs", "group:web"] },
      });

      await useToolsStore.getState().removeFromAllowList("group:fs");

      const allowList = useToolsStore.getState().config.allowList;
      expect(allowList).not.toContain("group:fs");
      expect(allowList).toContain("group:web");
    });
  });

  describe("removeFromDenyList", () => {
    it("should remove tool from deny list", async () => {
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["group:sessions", "group:memory"] },
      });

      await useToolsStore.getState().removeFromDenyList("group:sessions");

      const denyList = useToolsStore.getState().config.denyList;
      expect(denyList).not.toContain("group:sessions");
      expect(denyList).toContain("group:memory");
    });
  });

  describe("selectors", () => {
    it("selectTools should return all tools", async () => {
      const { selectTools } = await import("../index");
      const tools = selectTools(useToolsStore.getState());
      expect(tools).toHaveLength(5);
    });

    it("selectToolsConfig should return config", async () => {
      const { selectToolsConfig } = await import("../index");
      const config = selectToolsConfig(useToolsStore.getState());
      expect(config.accessMode).toBe("auto");
      expect(config.sandboxEnabled).toBe(true);
    });

    it("selectAccessMode should return access mode", async () => {
      const { selectAccessMode } = await import("../index");
      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, accessMode: "ask" },
      });

      expect(selectAccessMode(useToolsStore.getState())).toBe("ask");
    });

    it("selectEnabledTools should return only enabled tools", async () => {
      const { selectEnabledTools } = await import("../index");
      const enabledTools = selectEnabledTools(useToolsStore.getState());
      expect(enabledTools).toHaveLength(3);
      expect(enabledTools.map((t) => t.id)).toContain("group:fs");
      expect(enabledTools.map((t) => t.id)).toContain("group:web");
      expect(enabledTools.map((t) => t.id)).toContain("group:runtime");
    });

    it("selectToolById should return specific tool", async () => {
      const { selectToolById } = await import("../index");

      const fsTool = selectToolById("group:fs")(useToolsStore.getState());
      expect(fsTool?.name).toBe("File Operations");

      const nonExistent = selectToolById("nonexistent")(useToolsStore.getState());
      expect(nonExistent).toBeUndefined();
    });

    it("selectIsLoading should return loading state", async () => {
      const { selectIsLoading } = await import("../index");
      useToolsStore.setState({ ...initialState, isLoading: true });
      expect(selectIsLoading(useToolsStore.getState())).toBe(true);
    });

    it("selectError should return error", async () => {
      const { selectError } = await import("../index");
      useToolsStore.setState({ ...initialState, error: "Test error" });
      expect(selectError(useToolsStore.getState())).toBe("Test error");
    });
  });
});
