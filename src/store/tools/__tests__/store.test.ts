import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { useToolsStore, type Tool } from "../index";

// Mock IPC
vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
}));

const defaultTools: Tool[] = [
  {
    id: "fs",
    name: "File System",
    description: "Read, write, and manage files on the system",
    category: "filesystem",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "web",
    name: "Web Access",
    description: "Browse websites and fetch web content",
    category: "web",
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: "bash",
    name: "Command Execution",
    description: "Execute shell commands and scripts",
    category: "command",
    enabled: true,
    requiresConfirmation: true,
  },
  {
    id: "database",
    name: "Database",
    description: "Query and manage database connections",
    category: "database",
    enabled: false,
    requiresConfirmation: true,
  },
  {
    id: "media",
    name: "Media Processing",
    description: "Process images, audio, and video files",
    category: "media",
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
  },
  isLoading: false,
  error: null,
};

describe("ToolsStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useToolsStore.setState(initialState);
    vi.clearAllMocks();
  });

  describe("loadTools", () => {
    it("should load tools config from IPC", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockResolvedValue({
        tools: {
          access: "ask",
          allow: ["fs", "web"],
          deny: ["database"],
          sandbox: { enabled: false },
        },
      });

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      const state = useToolsStore.getState();
      expect(state.config.accessMode).toBe("ask");
      expect(state.config.allowList).toEqual(["fs", "web"]);
      expect(state.config.denyList).toEqual(["database"]);
      expect(state.config.sandboxEnabled).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it("should update tools enabled status based on deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockResolvedValue({
        tools: {
          access: "auto",
          allow: [],
          deny: ["fs", "web"],
          sandbox: { enabled: true },
        },
      });

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      const state = useToolsStore.getState();
      const fsTool = state.tools.find((t) => t.id === "fs");
      const webTool = state.tools.find((t) => t.id === "web");

      expect(fsTool?.enabled).toBe(false);
      expect(webTool?.enabled).toBe(false);
    });

    it("should enable tools in allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockResolvedValue({
        tools: {
          access: "auto",
          allow: ["database", "media"],
          deny: [],
          sandbox: { enabled: true },
        },
      });

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      const state = useToolsStore.getState();
      const dbTool = state.tools.find((t) => t.id === "database");
      const mediaTool = state.tools.find((t) => t.id === "media");

      expect(dbTool?.enabled).toBe(true);
      expect(mediaTool?.enabled).toBe(true);
    });

    it("should handle null config", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockResolvedValue(null);

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      expect(useToolsStore.getState().isLoading).toBe(false);
    });

    it("should handle config without tools", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockResolvedValue({});

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      expect(useToolsStore.getState().isLoading).toBe(false);
    });

    it("should handle load error", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.get as Mock).mockRejectedValue(new Error("Config load failed"));

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      const state = useToolsStore.getState();
      expect(state.error).toBe("Config load failed");
      expect(state.isLoading).toBe(false);
    });

    it("should set loading state during load", async () => {
      const { ipc } = await import("@/lib/ipc");

      let capturedLoading = false;
      (ipc.config.get as Mock).mockImplementation(() => {
        capturedLoading = useToolsStore.getState().isLoading;
        return Promise.resolve({});
      });

      const { loadTools } = useToolsStore.getState();
      await loadTools();

      expect(capturedLoading).toBe(true);
    });
  });

  describe("setAccessMode", () => {
    it("should update access mode to auto", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { setAccessMode } = useToolsStore.getState();
      await setAccessMode("auto");

      expect(useToolsStore.getState().config.accessMode).toBe("auto");
    });

    it("should update access mode to ask", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { setAccessMode } = useToolsStore.getState();
      await setAccessMode("ask");

      expect(useToolsStore.getState().config.accessMode).toBe("ask");
    });

    it("should update access mode to deny", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { setAccessMode } = useToolsStore.getState();
      await setAccessMode("deny");

      expect(useToolsStore.getState().config.accessMode).toBe("deny");
    });

    it("should persist to config", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { setAccessMode } = useToolsStore.getState();
      await setAccessMode("ask");

      expect(ipc.config.set).toHaveBeenCalledWith({
        tools: expect.objectContaining({
          access: "ask",
        }),
      });
    });

    it("should handle save error gracefully", async () => {
      const { ipc } = await import("@/lib/ipc");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      (ipc.config.set as Mock).mockRejectedValue(new Error("Save failed"));

      const { setAccessMode } = useToolsStore.getState();
      await setAccessMode("deny");

      // State should still be updated locally
      expect(useToolsStore.getState().config.accessMode).toBe("deny");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("enableTool", () => {
    it("should enable a tool", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { enableTool } = useToolsStore.getState();
      await enableTool("database");

      const state = useToolsStore.getState();
      const dbTool = state.tools.find((t) => t.id === "database");
      expect(dbTool?.enabled).toBe(true);
    });

    it("should add tool to allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { enableTool } = useToolsStore.getState();
      await enableTool("database");

      expect(useToolsStore.getState().config.allowList).toContain("database");
    });

    it("should remove tool from deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["database", "media"] },
      });

      const { enableTool } = useToolsStore.getState();
      await enableTool("database");

      const state = useToolsStore.getState();
      expect(state.config.denyList).not.toContain("database");
      expect(state.config.denyList).toContain("media");
    });

    it("should not duplicate in allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["database"] },
      });

      const { enableTool } = useToolsStore.getState();
      await enableTool("database");

      const allowList = useToolsStore.getState().config.allowList;
      expect(allowList.filter((id) => id === "database")).toHaveLength(1);
    });

    it("should persist config", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { enableTool } = useToolsStore.getState();
      await enableTool("database");

      expect(ipc.config.set).toHaveBeenCalledWith({
        tools: expect.objectContaining({
          allow: expect.arrayContaining(["database"]),
        }),
      });
    });
  });

  describe("disableTool", () => {
    it("should disable a tool", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { disableTool } = useToolsStore.getState();
      await disableTool("fs");

      const state = useToolsStore.getState();
      const fsTool = state.tools.find((t) => t.id === "fs");
      expect(fsTool?.enabled).toBe(false);
    });

    it("should add tool to deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { disableTool } = useToolsStore.getState();
      await disableTool("fs");

      expect(useToolsStore.getState().config.denyList).toContain("fs");
    });

    it("should remove tool from allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["fs", "web"] },
      });

      const { disableTool } = useToolsStore.getState();
      await disableTool("fs");

      const state = useToolsStore.getState();
      expect(state.config.allowList).not.toContain("fs");
      expect(state.config.allowList).toContain("web");
    });

    it("should not duplicate in deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["fs"] },
      });

      const { disableTool } = useToolsStore.getState();
      await disableTool("fs");

      const denyList = useToolsStore.getState().config.denyList;
      expect(denyList.filter((id) => id === "fs")).toHaveLength(1);
    });
  });

  describe("toggleSandbox", () => {
    it("should enable sandbox", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, sandboxEnabled: false },
      });

      const { toggleSandbox } = useToolsStore.getState();
      await toggleSandbox(true);

      expect(useToolsStore.getState().config.sandboxEnabled).toBe(true);
    });

    it("should disable sandbox", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { toggleSandbox } = useToolsStore.getState();
      await toggleSandbox(false);

      expect(useToolsStore.getState().config.sandboxEnabled).toBe(false);
    });

    it("should persist config", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { toggleSandbox } = useToolsStore.getState();
      await toggleSandbox(false);

      expect(ipc.config.set).toHaveBeenCalledWith({
        tools: expect.objectContaining({
          sandbox: { enabled: false },
        }),
      });
    });
  });

  describe("addToAllowList", () => {
    it("should add tool to allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { addToAllowList } = useToolsStore.getState();
      await addToAllowList("database");

      expect(useToolsStore.getState().config.allowList).toContain("database");
    });

    it("should remove from deny list if present", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["database"] },
      });

      const { addToAllowList } = useToolsStore.getState();
      await addToAllowList("database");

      const state = useToolsStore.getState();
      expect(state.config.allowList).toContain("database");
      expect(state.config.denyList).not.toContain("database");
    });

    it("should not add if already in allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["database"] },
      });

      const { addToAllowList } = useToolsStore.getState();
      await addToAllowList("database");

      expect(ipc.config.set).not.toHaveBeenCalled();
    });
  });

  describe("addToDenyList", () => {
    it("should add tool to deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      const { addToDenyList } = useToolsStore.getState();
      await addToDenyList("fs");

      expect(useToolsStore.getState().config.denyList).toContain("fs");
    });

    it("should remove from allow list if present", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["fs"] },
      });

      const { addToDenyList } = useToolsStore.getState();
      await addToDenyList("fs");

      const state = useToolsStore.getState();
      expect(state.config.denyList).toContain("fs");
      expect(state.config.allowList).not.toContain("fs");
    });

    it("should not add if already in deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["fs"] },
      });

      const { addToDenyList } = useToolsStore.getState();
      await addToDenyList("fs");

      expect(ipc.config.set).not.toHaveBeenCalled();
    });
  });

  describe("removeFromAllowList", () => {
    it("should remove tool from allow list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, allowList: ["fs", "web"] },
      });

      const { removeFromAllowList } = useToolsStore.getState();
      await removeFromAllowList("fs");

      const allowList = useToolsStore.getState().config.allowList;
      expect(allowList).not.toContain("fs");
      expect(allowList).toContain("web");
    });
  });

  describe("removeFromDenyList", () => {
    it("should remove tool from deny list", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.config.set as Mock).mockResolvedValue(undefined);

      useToolsStore.setState({
        ...initialState,
        config: { ...initialState.config, denyList: ["database", "media"] },
      });

      const { removeFromDenyList } = useToolsStore.getState();
      await removeFromDenyList("database");

      const denyList = useToolsStore.getState().config.denyList;
      expect(denyList).not.toContain("database");
      expect(denyList).toContain("media");
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

      // Default: fs, web, bash are enabled; database, media are disabled
      expect(enabledTools).toHaveLength(3);
      expect(enabledTools.map((t) => t.id)).toContain("fs");
      expect(enabledTools.map((t) => t.id)).toContain("web");
      expect(enabledTools.map((t) => t.id)).toContain("bash");
    });

    it("selectToolById should return specific tool", async () => {
      const { selectToolById } = await import("../index");

      const fsTool = selectToolById("fs")(useToolsStore.getState());
      expect(fsTool?.name).toBe("File System");

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
