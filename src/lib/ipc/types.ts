// Shared types and helpers for IPC modules

import type {
  UpdateInfo,
  ChatRequest,
  ChatStreamEvent,
  ChatNormalizedRunEvent,
  GatewayStatus,
  GatewayEventFrame,
  LoginCredentials,
  LoginResult,
  SubscriptionStatus,
} from "@clawui/types";
import type { ClawUIState, ClawUISessionMetadata } from "@clawui/types/clawui";
import type {
  OpenClawConfig,
  OnboardingOpenClawConfig,
  ChannelConfig,
  ConfigSchemaV2,
  ConfigSetDraftInputV2,
  ConfigSetDraftResponseV2,
  ConfigSnapshotV2,
} from "@clawui/types/config";
import type {
  CredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetToolKeyInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
} from "@clawui/types/credentials";
import type {
  ModelsAuthOrderResult,
  ModelsCatalogResult,
  ModelsFallbacksResult,
  ModelsStatus,
  ModelsStatusProbeOptions,
} from "@clawui/types/models";
import type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  SubscriptionConfig,
} from "@clawui/types/onboarding";
import type { SessionsUsageResult, CostUsageSummary, UsageTimeSeries } from "@clawui/types/usage";

// Re-export types for backward compatibility
export type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  ChatRequest,
  ChatStreamEvent,
  ChatNormalizedRunEvent,
  OpenClawConfig,
  OnboardingOpenClawConfig,
  ChannelConfig,
  GatewayStatus,
  GatewayEventFrame,
  LoginCredentials,
  LoginResult,
  SubscriptionStatus,
  UpdateInfo,
  // config
  ConfigSchemaV2,
  ConfigSetDraftInputV2,
  ConfigSetDraftResponseV2,
  ConfigSnapshotV2,
  // credentials
  CredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetToolKeyInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
  // models
  ModelsAuthOrderResult,
  ModelsCatalogResult,
  ModelsFallbacksResult,
  ModelsStatus,
  ModelsStatusProbeOptions,
  // onboarding
  SubscriptionConfig,
  // usage
  SessionsUsageResult,
  CostUsageSummary,
  UsageTimeSeries,
  // clawui state
  ClawUIState,
  ClawUISessionMetadata,
};

// Alias for backward compatibility
export type OnboardingSubscriptionConfig = SubscriptionConfig;

export type SkillEntry = {
  name: string;
  description: string;
  source: string;
};

export type SkillsListResult = {
  skills: SkillEntry[];
};

export type ModelsAuthLoginOptions = {
  provider?: string;
  method?: string;
  setDefault?: boolean;
};

export type ModelsAuthOrderInput = {
  provider: string;
  agentId?: string;
};

export type ModelsAuthOrderSetInput = ModelsAuthOrderInput & {
  profileIds: string[];
};

export type WorkspaceFileEntry = {
  name: string;
  isDirectory: boolean;
  size: number;
  updatedAtMs: number;
};

export type WorkspaceListResult = {
  dir: string;
  files: WorkspaceFileEntry[];
};

export type WorkspaceReadFileResult = {
  path: string;
  content: string;
};

export type WorkspaceReadFileBase64Result = {
  path: string;
  base64: string;
};

export type PythonRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface ElectronAPI {
  gateway: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    getStatus: () => Promise<GatewayStatus>;
    installService: () => Promise<void>;
    restartService: () => Promise<void>;
    uninstallService: () => Promise<void>;
    onStatusChange: (callback: (status: GatewayStatus) => void) => () => void;
    onEvent: (callback: (event: GatewayEventFrame) => void) => () => void;
  };
  config: {
    getSnapshot: () => Promise<ConfigSnapshotV2>;
    getSchema: () => Promise<ConfigSchemaV2>;
    setDraft: (input: ConfigSetDraftInputV2) => Promise<ConfigSetDraftResponseV2>;
    getPath: () => Promise<string>;
  };
  profiles: {
    ensure: () => Promise<{ paths: { main: string; configAgent: string } }>;
    patchEnvBoth: (patch: Record<string, string | null | undefined>) => Promise<void>;
    getConfigPath: (profileId: "main" | "configAgent") => Promise<string>;
  };
  state: {
    get: () => Promise<ClawUIState>;
    patch: (partial: DeepPartial<ClawUIState>) => Promise<ClawUIState>;
    getPath: () => Promise<string>;
  };
  subscription: {
    login: (credentials: LoginCredentials) => Promise<LoginResult>;
    logout: () => Promise<void>;
    getStatus: () => Promise<SubscriptionStatus>;
  };
  app: {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<UpdateInfo | null>;
    quitAndInstall: () => void;
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  onboarding: {
    detect: () => Promise<RuntimeStatus>;
    install: () => Promise<void>;
    uninstall: () => Promise<void>;
    configureSubscription: (config: SubscriptionConfig) => Promise<void>;
    configureBYOK: (keys: BYOKConfig) => Promise<void>;
    validateApiKey: (provider: "anthropic" | "openai", apiKey: string) => Promise<boolean>;
    readConfig: () => Promise<OnboardingOpenClawConfig | null>;
    onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void;
  };
  chat: {
    connect: (url?: string) => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    send: (request: ChatRequest) => Promise<string>;
    request: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
    isConnected: () => Promise<boolean>;
    onStream: (callback: (event: ChatStreamEvent) => void) => () => void;
    onConnected: (callback: () => void) => () => void;
    onDisconnected: (callback: () => void) => () => void;
    onReconnected: (callback: () => void) => () => void;
    onError: (callback: (error: string) => void) => () => void;
    onNormalizedEvent: (callback: (event: ChatNormalizedRunEvent) => void) => () => void;
  };
  usage: {
    sessions: (params?: Record<string, unknown>) => Promise<SessionsUsageResult>;
    cost: (params?: Record<string, unknown>) => Promise<CostUsageSummary>;
    timeseries: (params?: Record<string, unknown>) => Promise<UsageTimeSeries>;
    logs: (params?: Record<string, unknown>) => Promise<unknown>;
  };
  models: {
    status: (options?: ModelsStatusProbeOptions) => Promise<ModelsStatus | null>;
    list: () => Promise<ModelsCatalogResult>;
    setDefault: (model: string) => Promise<void>;
    listFallbacks: () => Promise<ModelsFallbacksResult>;
    addFallback: (model: string) => Promise<void>;
    removeFallback: (model: string) => Promise<void>;
    clearFallbacks: () => Promise<void>;
    getAuthOrder: (input: ModelsAuthOrderInput) => Promise<ModelsAuthOrderResult>;
    setAuthOrder: (input: ModelsAuthOrderSetInput) => Promise<ModelsAuthOrderResult>;
    clearAuthOrder: (input: ModelsAuthOrderInput) => Promise<ModelsAuthOrderResult>;
    authLogin: (input?: ModelsAuthLoginOptions) => Promise<{ ok: true; stdout: string }>;
  };
  metadata: {
    generate: (sessionKey: string) => Promise<ClawUISessionMetadata>;
  };
  secrets: {
    patch: (patch: Record<string, unknown>) => Promise<void>;
  };
  credentials: {
    list: () => Promise<CredentialMeta[]>;
    setLlmKey: (input: SetLlmKeyInput) => Promise<void>;
    validate: (provider: string, key: string) => Promise<ValidateKeyResult>;
    setChannel: (input: SetChannelTokenInput) => Promise<void>;
    setProxy: (input: SetProxyInput) => Promise<void>;
    setToolKey: (input: SetToolKeyInput) => Promise<void>;
    delete: (input: DeleteCredentialInput) => Promise<void>;
    oauthDeviceStart: (provider: string) => Promise<{
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      expiresIn: number;
      interval: number;
    }>;
    oauthDevicePoll: (
      provider: string,
      deviceCode: string,
      interval: number,
    ) => Promise<{ profileId: string }>;
    oauthRefresh: (profileId: string) => Promise<boolean>;
    openCliLogin: (command: string) => Promise<void>;
  };
  security: {
    get: (paths: string[]) => Promise<Record<string, unknown>>;
    apply: (ops: Array<{ path: string; value: unknown }>) => Promise<void>;
  };
  skills?: {
    list: () => Promise<SkillsListResult>;
  };
  workspace?: {
    list: (subpath?: string, agentId?: string) => Promise<WorkspaceListResult>;
    readFile: (relativePath: string, agentId?: string) => Promise<WorkspaceReadFileResult>;
    readFileBase64: (
      relativePath: string,
      agentId?: string,
    ) => Promise<WorkspaceReadFileBase64Result>;
    runPython: (relativePath: string, agentId?: string) => Promise<PythonRunResult>;
    openInSystem: (relativePath: string, agentId?: string) => Promise<string>;
  };
  rescue?: {
    gateway: {
      start: () => Promise<void>;
      stop: () => Promise<void>;
      getStatus: () => Promise<GatewayStatus>;
      onStatusChange: (callback: (status: GatewayStatus) => void) => () => void;
    };
    chat: {
      connect: (url?: string) => Promise<boolean>;
      disconnect: () => Promise<boolean>;
      send: (request: ChatRequest) => Promise<string>;
      request: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
      isConnected: () => Promise<boolean>;
      onStream: (callback: (event: ChatStreamEvent) => void) => () => void;
      onConnected: (callback: () => void) => () => void;
      onDisconnected: (callback: () => void) => () => void;
      onError: (callback: (error: string) => void) => () => void;
    };
  };
}

// Get the electron API from the preload script
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== "undefined" && "electron" in window) {
    return (window as unknown as { electron: ElectronAPI }).electron;
  }
  return null;
}
