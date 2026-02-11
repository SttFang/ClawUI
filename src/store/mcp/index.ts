import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc } from "@/lib/ipc";
import { useConfigDraftStore } from "@/store/configDraft";
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

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function toPersistedServerConfig(servers: MCPServer[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const server of servers) {
    record[server.id] = {
      command: server.command,
      args: server.args,
      env: server.env,
      enabled: server.enabled,
    };
  }
  return record;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string") out[key] = item;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const initialState: MCPState = {
  servers: [],
  isLoading: false,
  error: null,
  expandedServerId: null,
};

export const useMCPStore = create<MCPStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadServers: async () => {
        set({ isLoading: true, error: null }, false, "loadServers");
        try {
          const snapshot = await ipc.config.getSnapshot();
          const root = asRecord(snapshot.config) ?? {};
          const mcp = asRecord(root.mcp);
          const serverConfigs = asRecord(mcp?.servers);
          if (serverConfigs) {
            const servers: MCPServer[] = Object.entries(serverConfigs).map(([id, serverConfig]) => {
              const server = asRecord(serverConfig) ?? {};
              return {
                id,
                name: id,
                command: typeof server.command === "string" ? server.command : "",
                args: Array.isArray(server.args)
                  ? server.args.filter((item): item is string => typeof item === "string")
                  : [],
                env: toStringRecord(server.env),
                enabled: typeof server.enabled === "boolean" ? server.enabled : true,
                status: "stopped" as const,
                tools: [],
              };
            });
            set({ servers, isLoading: false }, false, "loadServers/success");
          } else {
            set({ servers: [], isLoading: false }, false, "loadServers/empty");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to load MCP servers";
          set({ error: message, isLoading: false }, false, "loadServers/error");
        }
      },

      addServer: async (serverData) => {
        const { servers } = get();
        const id = serverData.name.toLowerCase().replace(/\s+/g, "-");

        if (servers.some((s) => s.id === id)) {
          set(
            { error: `Server "${serverData.name}" already exists` },
            false,
            "addServer/duplicate",
          );
          return;
        }

        const newServer: MCPServer = {
          ...serverData,
          id,
          status: "stopped",
          tools: [],
        };

        set({ servers: [...servers, newServer], error: null }, false, "addServer/optimistic");

        try {
          const nextServers = [...servers, newServer];
          await useConfigDraftStore
            .getState()
            .applyPathPatch(["mcp", "servers"], toPersistedServerConfig(nextServers));
        } catch (error) {
          set(
            { servers, error: error instanceof Error ? error.message : "Failed to add server" },
            false,
            "addServer/rollback",
          );
        }
      },

      removeServer: async (id) => {
        const { servers } = get();
        const serverToRemove = servers.find((s) => s.id === id);
        if (!serverToRemove) return;

        set({ isLoading: true, error: null }, false, "removeServer");

        try {
          const nextServers = servers.filter((s) => s.id !== id);
          await useConfigDraftStore
            .getState()
            .applyPathPatch(["mcp", "servers"], toPersistedServerConfig(nextServers));

          set(
            {
              servers: nextServers,
              isLoading: false,
              expandedServerId: get().expandedServerId === id ? null : get().expandedServerId,
            },
            false,
            "removeServer/success",
          );
        } catch (error) {
          set(
            {
              error: error instanceof Error ? error.message : "Failed to remove server",
              isLoading: false,
            },
            false,
            "removeServer/error",
          );
        }
      },

      updateServer: async (id, updates) => {
        const { servers } = get();
        const serverIndex = servers.findIndex((s) => s.id === id);
        if (serverIndex === -1) return;

        const updatedServer = { ...servers[serverIndex], ...updates };
        const newServers = [...servers];
        newServers[serverIndex] = updatedServer;

        set({ servers: newServers, error: null }, false, "updateServer/optimistic");

        try {
          await useConfigDraftStore
            .getState()
            .applyPathPatch(["mcp", "servers"], toPersistedServerConfig(newServers));
        } catch (error) {
          set(
            { servers, error: error instanceof Error ? error.message : "Failed to update server" },
            false,
            "updateServer/rollback",
          );
        }
      },

      toggleServer: async (id) => {
        const { servers } = get();
        const server = servers.find((s) => s.id === id);
        if (!server) return;

        await get().updateServer(id, { enabled: !server.enabled });
      },

      setExpandedServer: (id) => {
        set({ expandedServerId: id }, false, "setExpandedServer");
      },
    }),
    { name: "MCPStore" },
  ),
);

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

export const mcpSelectors = {
  selectServers,
  selectIsLoading,
  selectError,
  selectExpandedServerId,
  selectServerById,
  selectEnabledServers,
};
