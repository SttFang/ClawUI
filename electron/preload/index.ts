import type { ChatNormalizedRunEvent } from "@clawui/types";
import { contextBridge, ipcRenderer } from "electron";

export type GatewayStatus = "stopped" | "starting" | "running" | "error";

export interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

export interface InstallProgress {
  stage: "checking-requirements" | "installing-openclaw" | "verifying" | "complete" | "error";
  progress: number;
  message: string;
  error?: string;
}

export interface RuntimeStatus {
  nodeInstalled: boolean;
  nodeVersion: string | null;
  nodePath: string | null;
  openclawInstalled: boolean;
  openclawVersion: string | null;
  openclawPath: string | null;
  configExists: boolean;
  configValid: boolean;
  configSchemaVersion?: string | null;
  configPath: string;
}

export interface BYOKConfig {
  anthropic?: string;
  openai?: string;
}

export interface SubscriptionConfig {
  proxyUrl: string;
  proxyToken: string;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  /**
   * Optional stable idempotency key for this chat run (maps to OpenClaw runId).
   */
  messageId?: string;
  model?: string;
}

export interface ChatStreamEvent {
  type: "start" | "delta" | "end" | "error";
  sessionId: string;
  messageId: string;
  content?: string;
  error?: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  gateway: {
    start: () => ipcRenderer.invoke("gateway:start"),
    stop: () => ipcRenderer.invoke("gateway:stop"),
    getStatus: () => ipcRenderer.invoke("gateway:status"),
    installService: () => ipcRenderer.invoke("gateway:install-service"),
    restartService: () => ipcRenderer.invoke("gateway:restart-service"),
    uninstallService: () => ipcRenderer.invoke("gateway:uninstall-service"),
    onStatusChange: (callback: (status: GatewayStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: GatewayStatus) =>
        callback(status);
      ipcRenderer.on("gateway:status-changed", listener);
      return () => {
        ipcRenderer.removeListener("gateway:status-changed", listener);
      };
    },
    onEvent: (callback: (event: GatewayEventFrame) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, evt: GatewayEventFrame) => callback(evt);
      ipcRenderer.on("gateway:event", listener);
      return () => {
        ipcRenderer.removeListener("gateway:event", listener);
      };
    },
  },
  config: {
    getSnapshot: () => ipcRenderer.invoke("config:snapshot"),
    getSchema: () => ipcRenderer.invoke("config:schema"),
    setDraft: (input: unknown) => ipcRenderer.invoke("config:set-draft", input),
    getPath: () => ipcRenderer.invoke("config:path"),
  },
  profiles: {
    ensure: () => ipcRenderer.invoke("profiles:ensure"),
    patchEnvBoth: (patch: Record<string, string | null | undefined>) =>
      ipcRenderer.invoke("profiles:patch-env-both", patch),
    getConfigPath: (profileId: "main" | "configAgent") =>
      ipcRenderer.invoke("profiles:config-path", profileId),
  },
  state: {
    get: () => ipcRenderer.invoke("state:get"),
    patch: (partial: unknown) => ipcRenderer.invoke("state:patch", partial),
    getPath: () => ipcRenderer.invoke("state:path"),
  },
  subscription: {
    login: (credentials: { email: string; password: string }) =>
      ipcRenderer.invoke("subscription:login", credentials),
    logout: () => ipcRenderer.invoke("subscription:logout"),
    getStatus: () => ipcRenderer.invoke("subscription:status"),
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:version"),
    checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
    quitAndInstall: () => ipcRenderer.send("app:quit-and-install"),
    minimize: () => ipcRenderer.send("app:minimize"),
    maximize: () => ipcRenderer.send("app:maximize"),
    close: () => ipcRenderer.send("app:close"),
  },
  onboarding: {
    detect: () => ipcRenderer.invoke("onboarding:detect"),
    install: () => ipcRenderer.invoke("onboarding:install"),
    uninstall: () => ipcRenderer.invoke("onboarding:uninstall"),
    configureSubscription: (config: SubscriptionConfig) =>
      ipcRenderer.invoke("onboarding:configure-subscription", config),
    configureBYOK: (keys: BYOKConfig) => ipcRenderer.invoke("onboarding:configure-byok", keys),
    validateApiKey: (provider: "anthropic" | "openai", apiKey: string) =>
      ipcRenderer.invoke("onboarding:validate-api-key", provider, apiKey),
    readConfig: () => ipcRenderer.invoke("onboarding:read-config"),
    onInstallProgress: (callback: (progress: InstallProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) =>
        callback(progress);
      ipcRenderer.on("onboarding:install-progress", listener);
      return () => {
        ipcRenderer.removeListener("onboarding:install-progress", listener);
      };
    },
  },
  chat: {
    connect: (url?: string) => ipcRenderer.invoke("chat:connect", url),
    disconnect: () => ipcRenderer.invoke("chat:disconnect"),
    send: (request: ChatRequest) => ipcRenderer.invoke("chat:send", request),
    request: (method: string, params?: Record<string, unknown>) =>
      ipcRenderer.invoke("chat:request", method, params),
    isConnected: () => ipcRenderer.invoke("chat:isConnected"),
    onStream: (callback: (event: ChatStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ChatStreamEvent) => callback(data);
      ipcRenderer.on("chat:stream", listener);
      return () => ipcRenderer.removeListener("chat:stream", listener);
    },
    onConnected: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("chat:connected", listener);
      return () => ipcRenderer.removeListener("chat:connected", listener);
    },
    onDisconnected: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("chat:disconnected", listener);
      return () => ipcRenderer.removeListener("chat:disconnected", listener);
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on("chat:error", listener);
      return () => ipcRenderer.removeListener("chat:error", listener);
    },
    onNormalizedEvent: (callback: (event: ChatNormalizedRunEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, evt: ChatNormalizedRunEvent) =>
        callback(evt);
      ipcRenderer.on("chat:normalized-event", listener);
      return () => ipcRenderer.removeListener("chat:normalized-event", listener);
    },
  },
  usage: {
    sessions: (params?: Record<string, unknown>) => ipcRenderer.invoke("usage:sessions", params),
    cost: (params?: Record<string, unknown>) => ipcRenderer.invoke("usage:cost", params),
    timeseries: (params?: Record<string, unknown>) =>
      ipcRenderer.invoke("usage:timeseries", params),
    logs: (params?: Record<string, unknown>) => ipcRenderer.invoke("usage:logs", params),
  },
  models: {
    status: (options?: {
      probe?: boolean;
      probeProvider?: string;
      probeProfile?: string[];
      probeTimeout?: number;
      probeConcurrency?: number;
      probeMaxTokens?: number;
    }) => ipcRenderer.invoke("models:status", options),
    list: () => ipcRenderer.invoke("models:list"),
    setDefault: (model: string) => ipcRenderer.invoke("models:set-default", model),
    listFallbacks: () => ipcRenderer.invoke("models:fallbacks-list"),
    addFallback: (model: string) => ipcRenderer.invoke("models:fallbacks-add", model),
    removeFallback: (model: string) => ipcRenderer.invoke("models:fallbacks-remove", model),
    clearFallbacks: () => ipcRenderer.invoke("models:fallbacks-clear"),
    getAuthOrder: (input: { provider: string; agentId?: string }) =>
      ipcRenderer.invoke("models:auth-order-get", input),
    setAuthOrder: (input: { provider: string; profileIds: string[]; agentId?: string }) =>
      ipcRenderer.invoke("models:auth-order-set", input),
    clearAuthOrder: (input: { provider: string; agentId?: string }) =>
      ipcRenderer.invoke("models:auth-order-clear", input),
    authLogin: (input?: { provider?: string; method?: string; setDefault?: boolean }) =>
      ipcRenderer.invoke("models:auth-login", input),
  },
  metadata: {
    generate: (sessionKey: string) => ipcRenderer.invoke("metadata:generate", sessionKey),
  },
  secrets: {
    patch: (patch: Record<string, unknown>) => ipcRenderer.invoke("secrets:patch", patch),
  },
  credentials: {
    list: () => ipcRenderer.invoke("credentials:list"),
    setLlmKey: (input: unknown) => ipcRenderer.invoke("credentials:set-llm-key", input),
    validate: (provider: string, key: string) =>
      ipcRenderer.invoke("credentials:validate", provider, key),
    setChannel: (input: unknown) => ipcRenderer.invoke("credentials:set-channel", input),
    setProxy: (input: unknown) => ipcRenderer.invoke("credentials:set-proxy", input),
    delete: (input: unknown) => ipcRenderer.invoke("credentials:delete", input),
  },
  security: {
    get: (paths: string[]) => ipcRenderer.invoke("security:get", paths),
    apply: (ops: Array<{ path: string; value: unknown }>) =>
      ipcRenderer.invoke("security:apply", ops),
  },
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
  },
});
