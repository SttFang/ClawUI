export type ToolAccessMode = "auto" | "ask" | "deny";
export type ExecHostMode = "sandbox" | "gateway" | "node";
export type ExecAskMode = "off" | "on-miss" | "always";
export type ExecSecurityMode = "deny" | "allowlist" | "full";

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  requiresConfirmation: boolean;
}

export interface ToolsConfig {
  accessMode: ToolAccessMode;
  allowList: string[];
  denyList: string[];
  sandboxEnabled: boolean;
  execHost: ExecHostMode;
  execAsk: ExecAskMode;
  execSecurity: ExecSecurityMode;
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
  setExecHost: (host: ExecHostMode) => Promise<void>;
  setExecAsk: (ask: ExecAskMode) => Promise<void>;
  setExecSecurity: (security: ExecSecurityMode) => Promise<void>;
  setPolicyLists: (lists: { allowList: string[]; denyList: string[] }) => Promise<void>;
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
