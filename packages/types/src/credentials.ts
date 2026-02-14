// ============================================
// Credential Types
// ============================================

export type CredentialMode = "api_key" | "token" | "oauth";

export type CredentialCategory = "llm" | "channel" | "proxy" | "tool";

export interface LlmCredentialMeta {
  category: "llm";
  provider: string;
  profileId: string;
  mode: CredentialMode;
  maskedKey: string;
  hasKey: boolean;
  expires?: number;
  email?: string;
}

export interface ChannelCredentialMeta {
  category: "channel";
  channelType: string;
  tokenField: string;
  maskedValue: string;
  hasValue: boolean;
}

export interface ProxyCredentialMeta {
  category: "proxy";
  key: string;
  maskedValue: string;
  hasValue: boolean;
}

export interface ToolCredentialMeta {
  category: "tool";
  toolId: string;
  configPath: string;
  label: string;
  maskedValue: string;
  hasValue: boolean;
}

export type CredentialMeta =
  | LlmCredentialMeta
  | ChannelCredentialMeta
  | ProxyCredentialMeta
  | ToolCredentialMeta;

// IPC input types

export interface SetLlmKeyInput {
  provider: string;
  apiKey: string;
}

export interface SetLlmTokenInput {
  provider: string;
  token: string;
  expires?: number;
  email?: string;
}

export interface SetChannelTokenInput {
  channelType: string;
  tokenField: string;
  value: string;
}

export interface SetToolKeyInput {
  toolId: string;
  value: string;
}

export interface SetProxyInput {
  proxyUrl: string;
  proxyToken: string;
}

export interface ValidateKeyResult {
  valid: boolean;
  error?: string;
}

export interface DeleteCredentialInput {
  category: CredentialCategory;
  id: string;
}
