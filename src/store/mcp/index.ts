import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import { createWeakCachedSelector } from "@/store/utils/createWeakCachedSelector";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: object;
}

export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: "stopped" | "running" | "error";
  tools: MCPTool[];
}

interface MCPState {
  servers: MCPServer[];
  isLoading: boolean;
  error: string | null;
  expandedServerId: string | null;
}

interface MCPActions {
  loadServers: () => Promise<void>;
  addServer: (server: Omit<MCPServer, "id" | "status" | "tools">) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  updateServer: (id: string, updates: Partial<MCPServer>) => Promise<void>;
  toggleServer: (id: string) => Promise<void>;
  setExpandedServer: (id: string | null) => void;
}

type MCPStore = MCPState & MCPActions;

const initialState: MCPState = {
  servers: [],
  isLoading: false,
  error: null,
  expandedServerId: null,
};

export const useMCPStore = create<MCPStore>((set, get) => ({
  ...initialState,

  loadServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await ipc.config.get();
      if (config?.mcp?.servers) {
        const servers: MCPServer[] = Object.entries(config.mcp.servers).map(
          ([id, serverConfig]) => {
            const server = serverConfig as {
              command: string;
              args?: string[];
              env?: Record<string, string>;
              enabled?: boolean;
            };
            return {
              id,
              name: id,
              command: server.command,
              args: server.args || [],
              env: server.env,
              enabled: server.enabled ?? true,
              status: "stopped" as const,
              tools: [],
            };
          },
        );
        set({ servers, isLoading: false });
      } else {
        set({ servers: [], isLoading: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load MCP servers";
      set({ error: message, isLoading: false });
    }
  },

  addServer: async (serverData) => {
    const { servers } = get();
    const id = serverData.name.toLowerCase().replace(/\s+/g, "-");

    // Check for duplicate
    if (servers.some((s) => s.id === id)) {
      set({ error: `Server "${serverData.name}" already exists` });
      return;
    }

    const newServer: MCPServer = {
      ...serverData,
      id,
      status: "stopped",
      tools: [],
    };

    // Optimistic update
    set({ servers: [...servers, newServer], error: null });

    try {
      const config = await ipc.config.get();
      const mcpServers = config?.mcp?.servers || {};
      await ipc.config.set({
        mcp: {
          ...config?.mcp,
          servers: {
            ...mcpServers,
            [id]: {
              command: serverData.command,
              args: serverData.args,
              env: serverData.env,
              enabled: serverData.enabled,
            },
          },
        },
      });
    } catch (error) {
      // Rollback on error
      set({ servers, error: error instanceof Error ? error.message : "Failed to add server" });
    }
  },

  removeServer: async (id) => {
    const { servers } = get();
    const serverToRemove = servers.find((s) => s.id === id);
    if (!serverToRemove) return;

    set({ isLoading: true, error: null });

    try {
      const config = await ipc.config.get();
      const mcpServers = { ...config?.mcp?.servers };
      delete mcpServers[id];

      await ipc.config.set({
        mcp: {
          ...config?.mcp,
          servers: mcpServers,
        },
      });

      set({
        servers: servers.filter((s) => s.id !== id),
        isLoading: false,
        expandedServerId: get().expandedServerId === id ? null : get().expandedServerId,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to remove server",
        isLoading: false,
      });
    }
  },

  updateServer: async (id, updates) => {
    const { servers } = get();
    const serverIndex = servers.findIndex((s) => s.id === id);
    if (serverIndex === -1) return;

    const updatedServer = { ...servers[serverIndex], ...updates };
    const newServers = [...servers];
    newServers[serverIndex] = updatedServer;

    // Optimistic update
    set({ servers: newServers, error: null });

    try {
      const config = await ipc.config.get();
      const mcpServers = config?.mcp?.servers || {};
      await ipc.config.set({
        mcp: {
          ...config?.mcp,
          servers: {
            ...mcpServers,
            [id]: {
              command: updatedServer.command,
              args: updatedServer.args,
              env: updatedServer.env,
              enabled: updatedServer.enabled,
            },
          },
        },
      });
    } catch (error) {
      // Rollback on error
      set({ servers, error: error instanceof Error ? error.message : "Failed to update server" });
    }
  },

  toggleServer: async (id) => {
    const { servers } = get();
    const server = servers.find((s) => s.id === id);
    if (!server) return;

    await get().updateServer(id, { enabled: !server.enabled });
  },

  setExpandedServer: (id) => {
    set({ expandedServerId: id });
  },
}));

// Selectors
export const selectServers = (state: MCPStore) => state.servers;
export const selectIsLoading = (state: MCPStore) => state.isLoading;
export const selectError = (state: MCPStore) => state.error;
export const selectExpandedServerId = (state: MCPStore) => state.expandedServerId;
export const selectServerById = (id: string) => (state: MCPStore) =>
  state.servers.find((s) => s.id === id);
export const selectEnabledServers = createWeakCachedSelector((state: MCPStore) =>
  state.servers.filter((s) => s.enabled),
);
