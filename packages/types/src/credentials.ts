// ============================================
// Credential Types
// ============================================

export type CredentialCategory = "llm" | "channel" | "proxy";

export interface LlmCredentialMeta {
  category: "llm";
  provider: string;
  profileId: string;
  mode: "api_key";
  maskedKey: string;
  hasKey: boolean;
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

export type CredentialMeta = LlmCredentialMeta | ChannelCredentialMeta | ProxyCredentialMeta;

// IPC input types

export interface SetLlmKeyInput {
  provider: "anthropic" | "openai";
  apiKey: string;
}

export interface SetChannelTokenInput {
  channelType: string;
  tokenField: "botToken" | "appToken";
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
