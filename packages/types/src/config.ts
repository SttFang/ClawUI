// ============================================
// Configuration Types
// ============================================

/**
 * Channel configuration for messaging platforms
 */
export interface ChannelConfig {
  enabled: boolean;
  botToken?: string;
  appToken?: string;
  dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
  groupPolicy?: "allowlist" | "open" | "disabled";
  requireMention?: boolean;
  historyLimit?: number;
  allowFrom?: string[];
  mediaMaxMb?: number;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * OpenClaw configuration file structure
 */
export interface OpenClawConfig {
  gateway: {
    port: number;
    bind: string;
    token: string;
  };
  agents: {
    defaults: {
      workspace: string;
      model: {
        primary: string;
        fallbacks: string[];
      };
      sandbox: { enabled: boolean };
    };
  };
  session: {
    scope: "per-sender" | "per-channel-peer" | "main";
    store: string;
    reset: {
      mode: "idle" | "daily";
      idleMinutes: number;
    };
  };
  channels: {
    telegram?: ChannelConfig;
    discord?: ChannelConfig;
    whatsapp?: ChannelConfig;
    slack?: ChannelConfig;
    [key: string]: ChannelConfig | undefined;
  };
  tools: {
    access: "auto" | "ask" | "deny";
    allow: string[];
    deny: string[];
    sandbox: { enabled: boolean };
  };
  providers: {
    anthropic?: ProviderConfig;
    openai?: ProviderConfig;
    openrouter?: ProviderConfig;
    [key: string]: ProviderConfig | undefined;
  };
  env: Record<string, string>;
  cron: {
    enabled: boolean;
    store: string;
  };
  hooks: {
    enabled: boolean;
    token: string;
    path: string;
  };
  mcp?: {
    servers: Record<string, MCPServerConfig>;
  };
}

/**
 * Simplified config for onboarding display
 */
export interface OnboardingOpenClawConfig {
  models?: {
    anthropic?: {
      apiKey: string;
      models?: string[];
    };
    openai?: {
      apiKey: string;
      models?: string[];
    };
  };
  proxy?: {
    url: string;
    token?: string;
  };
  server?: {
    port: number;
    host: string;
  };
}
