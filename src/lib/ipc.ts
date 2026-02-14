// IPC client for renderer process
// This module provides type-safe IPC communication with the main process

import type { UpdateInfo } from "@clawui/types/app";
import type { ChatRequest, ChatStreamEvent } from "@clawui/types/chat";
import type { ChatNormalizedRunEvent } from "@clawui/types/chat-normalized/event";
import type { ClawUIState, ClawUISessionMetadata } from "@clawui/types/clawui";
import type { OpenClawConfig, OnboardingOpenClawConfig, ChannelConfig } from "@clawui/types/config";
import type {
  ConfigSchemaV2,
  ConfigSetDraftInputV2,
  ConfigSetDraftResponseV2,
  ConfigSnapshotV2,
} from "@clawui/types/config-v2";
import type {
  CredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetToolKeyInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
} from "@clawui/types/credentials";
import type { GatewayStatus, GatewayEventFrame } from "@clawui/types/gateway";
import type {
  ModelsAuthOrderResult,
  ModelsCatalogResult,
  ModelsFallbacksResult,
  ModelsStatus,
  ModelsStatusProbeOptions,
} from "@clawui/types/models";
// Import types from centralized package
import type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  SubscriptionConfig,
} from "@clawui/types/onboarding";
import type { LoginCredentials, LoginResult, SubscriptionStatus } from "@clawui/types/subscription";
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
};

// Alias for backward compatibility
export type OnboardingSubscriptionConfig = SubscriptionConfig;

export type OpenClawProfileId = "main" | "configAgent";

export type SkillsProfileList = {
  dir: string;
  skills: string[];
};

export type SkillsListResult = {
  profiles: Record<OpenClawProfileId, SkillsProfileList>;
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
  };
  security: {
    get: (paths: string[]) => Promise<Record<string, unknown>>;
    apply: (ops: Array<{ path: string; value: unknown }>) => Promise<void>;
  };
  skills?: {
    list: () => Promise<SkillsListResult>;
  };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function getBrowserFallbackRuntimeStatus(): RuntimeStatus {
  return {
    nodeInstalled: true,
    nodeVersion: null,
    nodePath: null,
    openclawInstalled: true,
    openclawVersion: null,
    openclawPath: null,
    configExists: true,
    configValid: true,
    configSchemaVersion: null,
    configPath: "",
  };
}

// Get the electron API from the preload script
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== "undefined" && "electron" in window) {
    return (window as unknown as { electron: ElectronAPI }).electron;
  }
  return null;
}

// Typed IPC helpers
export const ipc = {
  gateway: {
    async start() {
      const api = getElectronAPI();
      if (api) {
        await api.gateway.start();
      }
    },
    async stop() {
      const api = getElectronAPI();
      if (api) {
        await api.gateway.stop();
      }
    },
    async getStatus() {
      const api = getElectronAPI();
      return api?.gateway.getStatus() ?? Promise.resolve("stopped" as const);
    },
    async installService() {
      const api = getElectronAPI();
      if (!api?.gateway.installService)
        throw new Error("Gateway install API not available — restart the app");
      await api.gateway.installService();
    },
    async restartService() {
      const api = getElectronAPI();
      if (!api?.gateway.restartService)
        throw new Error("Gateway restart API not available — restart the app");
      await api.gateway.restartService();
    },
    async uninstallService() {
      const api = getElectronAPI();
      if (!api?.gateway.uninstallService)
        throw new Error("Gateway uninstall API not available — restart the app");
      await api.gateway.uninstallService();
    },
    onStatusChange(callback: (status: GatewayStatus) => void) {
      const api = getElectronAPI();
      return api?.gateway.onStatusChange(callback) ?? (() => {});
    },
    onEvent(callback: (event: GatewayEventFrame) => void) {
      const api = getElectronAPI();
      return api?.gateway.onEvent(callback) ?? (() => {});
    },
  },
  config: {
    async getSnapshot() {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.config.getSnapshot();
    },
    async getSchema() {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.config.getSchema();
    },
    async setDraft(input: ConfigSetDraftInputV2) {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      const result = await api.config.setDraft(input);
      if (!result.ok) {
        const error = new Error(result.error.message) as Error & { code?: string };
        error.code = result.error.code;
        throw error;
      }
      return result;
    },
    async getPath() {
      const api = getElectronAPI();
      return api?.config.getPath() ?? "";
    },
  },
  profiles: {
    async ensure() {
      const api = getElectronAPI();
      if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
      return api.profiles.ensure();
    },
    async patchEnvBoth(patch: Record<string, string | null | undefined>) {
      const api = getElectronAPI();
      if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
      await api.profiles.patchEnvBoth(patch);
    },
    async getConfigPath(profileId: "main" | "configAgent") {
      const api = getElectronAPI();
      if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
      return api.profiles.getConfigPath(profileId);
    },
  },
  state: {
    async get() {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.state.get();
    },
    async patch(partial: DeepPartial<ClawUIState>) {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.state.patch(partial);
    },
    async getPath() {
      const api = getElectronAPI();
      return api?.state.getPath() ?? "";
    },
  },
  subscription: {
    async login(credentials: LoginCredentials) {
      const api = getElectronAPI();
      return api?.subscription.login(credentials);
    },
    async logout() {
      const api = getElectronAPI();
      if (api) {
        await api.subscription.logout();
      }
    },
    async getStatus() {
      const api = getElectronAPI();
      return api?.subscription.getStatus();
    },
  },
  app: {
    async getVersion() {
      const api = getElectronAPI();
      return api?.app.getVersion() ?? "0.0.0";
    },
    async checkForUpdates() {
      const api = getElectronAPI();
      return api?.app.checkForUpdates() ?? null;
    },
    quitAndInstall() {
      const api = getElectronAPI();
      api?.app.quitAndInstall();
    },
    minimize() {
      const api = getElectronAPI();
      api?.app.minimize();
    },
    maximize() {
      const api = getElectronAPI();
      api?.app.maximize();
    },
    close() {
      const api = getElectronAPI();
      api?.app.close();
    },
  },
  onboarding: {
    async detect() {
      const api = getElectronAPI();
      if (api?.onboarding.detect) return api.onboarding.detect();
      // Browser renderer-only debug fallback:
      // keep app route available when preload bridge is absent.
      return getBrowserFallbackRuntimeStatus();
    },
    async install() {
      const api = getElectronAPI();
      if (api) {
        await api.onboarding.install();
      }
    },
    async uninstall() {
      const api = getElectronAPI();
      if (api) {
        await api.onboarding.uninstall();
      }
    },
    async configureSubscription(config: SubscriptionConfig) {
      const api = getElectronAPI();
      if (api) {
        await api.onboarding.configureSubscription(config);
      }
    },
    async configureBYOK(keys: BYOKConfig) {
      const api = getElectronAPI();
      if (api) {
        await api.onboarding.configureBYOK(keys);
      }
    },
    async validateApiKey(provider: "anthropic" | "openai", apiKey: string) {
      const api = getElectronAPI();
      return api?.onboarding.validateApiKey(provider, apiKey) ?? false;
    },
    async readConfig() {
      const api = getElectronAPI();
      return api?.onboarding.readConfig() ?? null;
    },
    onInstallProgress(callback: (progress: InstallProgress) => void) {
      const api = getElectronAPI();
      return api?.onboarding.onInstallProgress(callback) ?? (() => {});
    },
  },
  chat: {
    async connect(url?: string) {
      const api = getElectronAPI();
      return api?.chat.connect(url) ?? false;
    },
    async disconnect() {
      const api = getElectronAPI();
      return api?.chat.disconnect() ?? false;
    },
    async send(request: ChatRequest) {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.chat.send(request);
    },
    async request(method: string, params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api) throw new Error("Electron API not available");
      return api.chat.request(method, params);
    },
    async isConnected() {
      const api = getElectronAPI();
      return api?.chat.isConnected() ?? false;
    },
    onStream(callback: (event: ChatStreamEvent) => void) {
      const api = getElectronAPI();
      return api?.chat.onStream(callback) ?? (() => {});
    },
    onConnected(callback: () => void) {
      const api = getElectronAPI();
      return api?.chat.onConnected(callback) ?? (() => {});
    },
    onDisconnected(callback: () => void) {
      const api = getElectronAPI();
      return api?.chat.onDisconnected(callback) ?? (() => {});
    },
    onError(callback: (error: string) => void) {
      const api = getElectronAPI();
      return api?.chat.onError(callback) ?? (() => {});
    },
    onNormalizedEvent(callback: (event: ChatNormalizedRunEvent) => void) {
      const api = getElectronAPI();
      return api?.chat.onNormalizedEvent(callback) ?? (() => {});
    },
  },
  usage: {
    async sessions(params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api?.usage) throw new Error("Usage API not available — restart the app");
      return api.usage.sessions(params);
    },
    async cost(params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api?.usage) throw new Error("Usage API not available — restart the app");
      return api.usage.cost(params);
    },
    async timeseries(params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api?.usage) throw new Error("Usage API not available — restart the app");
      return api.usage.timeseries(params);
    },
    async logs(params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api?.usage) throw new Error("Usage API not available — restart the app");
      return api.usage.logs(params);
    },
  },
  models: {
    async status(options?: ModelsStatusProbeOptions): Promise<ModelsStatus | null> {
      const api = getElectronAPI();
      return api?.models.status(options) ?? null;
    },
    async list(): Promise<ModelsCatalogResult> {
      const api = getElectronAPI();
      if (!api?.models?.list) throw new Error("Models API not available — restart the app");
      return api.models.list();
    },
    async setDefault(model: string): Promise<void> {
      const api = getElectronAPI();
      if (!api?.models?.setDefault) throw new Error("Models API not available — restart the app");
      await api.models.setDefault(model);
    },
    async listFallbacks(): Promise<ModelsFallbacksResult> {
      const api = getElectronAPI();
      if (!api?.models?.listFallbacks)
        throw new Error("Models API not available — restart the app");
      return api.models.listFallbacks();
    },
    async addFallback(model: string): Promise<void> {
      const api = getElectronAPI();
      if (!api?.models?.addFallback) throw new Error("Models API not available — restart the app");
      await api.models.addFallback(model);
    },
    async removeFallback(model: string): Promise<void> {
      const api = getElectronAPI();
      if (!api?.models?.removeFallback)
        throw new Error("Models API not available — restart the app");
      await api.models.removeFallback(model);
    },
    async clearFallbacks(): Promise<void> {
      const api = getElectronAPI();
      if (!api?.models?.clearFallbacks)
        throw new Error("Models API not available — restart the app");
      await api.models.clearFallbacks();
    },
    async getAuthOrder(input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> {
      const api = getElectronAPI();
      if (!api?.models?.getAuthOrder) throw new Error("Models API not available — restart the app");
      return api.models.getAuthOrder(input);
    },
    async setAuthOrder(input: ModelsAuthOrderSetInput): Promise<ModelsAuthOrderResult> {
      const api = getElectronAPI();
      if (!api?.models?.setAuthOrder) throw new Error("Models API not available — restart the app");
      return api.models.setAuthOrder(input);
    },
    async clearAuthOrder(input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> {
      const api = getElectronAPI();
      if (!api?.models?.clearAuthOrder)
        throw new Error("Models API not available — restart the app");
      return api.models.clearAuthOrder(input);
    },
    async authLogin(input?: ModelsAuthLoginOptions): Promise<{ ok: true; stdout: string }> {
      const api = getElectronAPI();
      if (!api?.models?.authLogin) throw new Error("Models API not available — restart the app");
      return api.models.authLogin(input);
    },
  },
  metadata: {
    async generate(sessionKey: string): Promise<ClawUISessionMetadata> {
      const api = getElectronAPI();
      if (!api?.metadata) throw new Error("Metadata API not available — restart the app");
      return api.metadata.generate(sessionKey);
    },
  },
  secrets: {
    async patch(patch: Record<string, unknown>): Promise<void> {
      const api = getElectronAPI();
      if (!api?.secrets) throw new Error("Secrets API not available — restart the app");
      await api.secrets.patch(patch);
    },
  },
  credentials: {
    async list(): Promise<CredentialMeta[]> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      return api.credentials.list();
    },
    async setLlmKey(input: SetLlmKeyInput): Promise<void> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      await api.credentials.setLlmKey(input);
    },
    async validate(provider: string, key: string): Promise<ValidateKeyResult> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      return api.credentials.validate(provider, key);
    },
    async setChannel(input: SetChannelTokenInput): Promise<void> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      await api.credentials.setChannel(input);
    },
    async setProxy(input: SetProxyInput): Promise<void> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      await api.credentials.setProxy(input);
    },
    async setToolKey(input: SetToolKeyInput): Promise<void> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      await api.credentials.setToolKey(input);
    },
    async delete(input: DeleteCredentialInput): Promise<void> {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      await api.credentials.delete(input);
    },
    async oauthDeviceStart(provider: string) {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      return api.credentials.oauthDeviceStart(provider);
    },
    async oauthDevicePoll(provider: string, deviceCode: string, interval: number) {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      return api.credentials.oauthDevicePoll(provider, deviceCode, interval);
    },
    async oauthRefresh(profileId: string) {
      const api = getElectronAPI();
      if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
      return api.credentials.oauthRefresh(profileId);
    },
  },
  security: {
    async get(paths: string[]): Promise<Record<string, unknown>> {
      const api = getElectronAPI();
      if (!api?.security) throw new Error("Security API not available — restart the app");
      return api.security.get(paths);
    },
    async apply(ops: Array<{ path: string; value: unknown }>): Promise<void> {
      const api = getElectronAPI();
      if (!api?.security) throw new Error("Security API not available — restart the app");
      await api.security.apply(ops);
    },
  },
  skills: {
    async list(): Promise<SkillsListResult> {
      const api = getElectronAPI();
      if (!api?.skills) throw new Error("Skills API not available — restart the app");
      return api.skills.list();
    },
  },
};
