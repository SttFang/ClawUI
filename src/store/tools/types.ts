export type ToolAccessMode = "auto" | "ask" | "deny";

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: "filesystem" | "web" | "command" | "database" | "media" | "mcp";
  enabled: boolean;
  requiresConfirmation: boolean;
}

export interface ToolsConfig {
  accessMode: ToolAccessMode;
  allowList: string[];
  denyList: string[];
  sandboxEnabled: boolean;
}

export interface ToolsState {
  tools: Tool[];
  config: ToolsConfig;
  isLoading: boolean;
  error: string | null;
}

export interface ToolsPublicActions {
  loadTools: () => Promise<void>;
  setAccessMode: (mode: ToolAccessMode) => Promise<void>;
  enableTool: (toolId: string) => Promise<void>;
  disableTool: (toolId: string) => Promise<void>;
  toggleSandbox: (enabled: boolean) => Promise<void>;
  addToAllowList: (toolId: string) => Promise<void>;
  addToDenyList: (toolId: string) => Promise<void>;
  removeFromAllowList: (toolId: string) => Promise<void>;
  removeFromDenyList: (toolId: string) => Promise<void>;
}

export interface ToolsInternalActions {
  internal_persistConfig: () => Promise<void>;
}

export type ToolsStore = ToolsState & ToolsPublicActions & ToolsInternalActions;
