import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
import { useMCPStore, type MCPServer } from "../index";

vi.mock("@/lib/ipc", () => ({
  ipc: {
    config: {
      getSnapshot: vi.fn(),
      setDraft: vi.fn(),
      getSchema: vi.fn(),
    },
  },
}));

const initialState = {
  servers: [] as MCPServer[],
  isLoading: false,
  error: null as string | null,
  expandedServerId: null as string | null,
};

function makeServer(overrides: Partial<MCPServer> = {}): MCPServer {
  return {
    id: "test-server",
    name: "test-server",
    command: "node",
    args: ["server.js"],
    enabled: true,
    status: "stopped",
    tools: [],
    ...overrides,
  };
}

describe("MCPStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMCPStore.setState(initialState);
    useConfigDraftStore.setState({
      snapshot: null,
      schema: null,
      draft: null,
      isLoading: false,
      isSaving: false,
      isDirty: false,
      error: null,
      errorCode: null,
    });
  });

  describe("loadServers", () => {
    it("should parse servers from config snapshot", async () => {
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: {
          mcp: {
            servers: {
              github: {
                command: "node",
                args: ["github-mcp.js"],
                env: { GITHUB_TOKEN: "tok" },
                enabled: true,
              },
            },
          },
        },
      });

      await useMCPStore.getState().loadServers();

      const state = useMCPStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.servers).toHaveLength(1);
      expect(state.servers[0]).toEqual({
        id: "github",
        name: "github",
        command: "node",
        args: ["github-mcp.js"],
        env: { GITHUB_TOKEN: "tok" },
        enabled: true,
        status: "stopped",
        tools: [],
      });
    });

    it("should set empty servers when no mcp config exists", async () => {
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: {},
      });

      await useMCPStore.getState().loadServers();

      expect(useMCPStore.getState().servers).toEqual([]);
      expect(useMCPStore.getState().isLoading).toBe(false);
    });

    it("should set error on failure", async () => {
      (ipc.config.getSnapshot as Mock).mockRejectedValue(
        new Error("network down"),
      );

      await useMCPStore.getState().loadServers();

      const state = useMCPStore.getState();
      expect(state.error).toBe("network down");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("addServer", () => {
    it("should optimistically add server then persist", async () => {
      // Stub configDraft so applyPathPatch resolves
      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: {},
      });
      (ipc.config.setDraft as Mock).mockResolvedValue(undefined);

      await useMCPStore.getState().addServer({
        name: "My Server",
        command: "npx",
        args: ["-y", "mcp-server"],
        enabled: true,
      });

      const state = useMCPStore.getState();
      expect(state.servers).toHaveLength(1);
      expect(state.servers[0].id).toBe("my-server");
      expect(state.servers[0].command).toBe("npx");
      expect(state.error).toBeNull();
    });

    it("should reject duplicate server ids", async () => {
      useMCPStore.setState({
        servers: [makeServer({ id: "dup", name: "dup" })],
      });

      await useMCPStore.getState().addServer({
        name: "dup",
        command: "node",
        args: [],
        enabled: true,
      });

      expect(useMCPStore.getState().error).toBe(
        'Server "dup" already exists',
      );
      expect(useMCPStore.getState().servers).toHaveLength(1);
    });

    it("should rollback on persist failure", async () => {
      (ipc.config.getSnapshot as Mock).mockRejectedValue(
        new Error("write failed"),
      );

      await useMCPStore.getState().addServer({
        name: "new-server",
        command: "node",
        args: [],
        enabled: true,
      });

      const state = useMCPStore.getState();
      // Rolled back to original empty array
      expect(state.servers).toHaveLength(0);
      expect(state.error).toBe("write failed");
    });
  });

  describe("removeServer", () => {
    it("should persist first then update UI on success", async () => {
      const existing = makeServer();
      useMCPStore.setState({ servers: [existing] });

      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: { mcp: { servers: {} } },
      });
      (ipc.config.setDraft as Mock).mockResolvedValue(undefined);

      await useMCPStore.getState().removeServer("test-server");

      const state = useMCPStore.getState();
      expect(state.servers).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it("should no-op for non-existent server", async () => {
      await useMCPStore.getState().removeServer("ghost");
      expect(useMCPStore.getState().servers).toEqual([]);
    });

    it("should keep servers on persist failure", async () => {
      const existing = makeServer();
      useMCPStore.setState({ servers: [existing] });

      (ipc.config.getSnapshot as Mock).mockRejectedValue(
        new Error("disk full"),
      );

      await useMCPStore.getState().removeServer("test-server");

      const state = useMCPStore.getState();
      // Server still present because persist failed
      expect(state.servers).toHaveLength(1);
      expect(state.error).toBe("disk full");
      expect(state.isLoading).toBe(false);
    });

    it("should clear expandedServerId when removing the expanded server", async () => {
      const existing = makeServer();
      useMCPStore.setState({
        servers: [existing],
        expandedServerId: "test-server",
      });

      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: { mcp: { servers: {} } },
      });
      (ipc.config.setDraft as Mock).mockResolvedValue(undefined);

      await useMCPStore.getState().removeServer("test-server");

      expect(useMCPStore.getState().expandedServerId).toBeNull();
    });
  });

  describe("updateServer", () => {
    it("should optimistically update then persist", async () => {
      const existing = makeServer();
      useMCPStore.setState({ servers: [existing] });

      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: {},
      });
      (ipc.config.setDraft as Mock).mockResolvedValue(undefined);

      await useMCPStore.getState().updateServer("test-server", {
        command: "bun",
        args: ["run", "server.ts"],
      });

      const updated = useMCPStore.getState().servers[0];
      expect(updated.command).toBe("bun");
      expect(updated.args).toEqual(["run", "server.ts"]);
    });

    it("should no-op for non-existent server", async () => {
      await useMCPStore.getState().updateServer("ghost", { command: "x" });
      expect(useMCPStore.getState().servers).toEqual([]);
    });

    it("should rollback on persist failure", async () => {
      const existing = makeServer({ command: "node" });
      useMCPStore.setState({ servers: [existing] });

      (ipc.config.getSnapshot as Mock).mockRejectedValue(
        new Error("persist error"),
      );

      await useMCPStore.getState().updateServer("test-server", {
        command: "bun",
      });

      const state = useMCPStore.getState();
      // Rolled back to original command
      expect(state.servers[0].command).toBe("node");
      expect(state.error).toBe("persist error");
    });
  });

  describe("toggleServer", () => {
    it("should flip enabled via updateServer", async () => {
      const existing = makeServer({ enabled: true });
      useMCPStore.setState({ servers: [existing] });

      (ipc.config.getSnapshot as Mock).mockResolvedValue({
        hash: "h1",
        config: {},
      });
      (ipc.config.setDraft as Mock).mockResolvedValue(undefined);

      await useMCPStore.getState().toggleServer("test-server");

      expect(useMCPStore.getState().servers[0].enabled).toBe(false);
    });

    it("should no-op for non-existent server", async () => {
      await useMCPStore.getState().toggleServer("ghost");
      expect(useMCPStore.getState().servers).toEqual([]);
    });
  });

  describe("setExpandedServer", () => {
    it("should set expandedServerId", () => {
      useMCPStore.getState().setExpandedServer("abc");
      expect(useMCPStore.getState().expandedServerId).toBe("abc");
    });

    it("should clear expandedServerId with null", () => {
      useMCPStore.setState({ expandedServerId: "abc" });
      useMCPStore.getState().setExpandedServer(null);
      expect(useMCPStore.getState().expandedServerId).toBeNull();
    });
  });
});
