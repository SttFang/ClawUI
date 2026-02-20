import type {
  BYOKConfig,
  ChatNormalizedRunEvent,
  ChatRequest,
  ChatStreamEvent,
  GatewayEventFrame,
  GatewayStatus,
  InstallProgress,
  SubscriptionConfig,
} from "@clawui/types";
import { contextBridge, ipcRenderer } from "electron";
import { createEventListener, createVoidListener } from "./helpers";

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
    onStatusChange: (cb: (status: GatewayStatus) => void) =>
      createEventListener<[GatewayStatus]>("gateway:status-changed", cb),
    onEvent: (cb: (event: GatewayEventFrame) => void) =>
      createEventListener<[GatewayEventFrame]>("gateway:event", cb),
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
    onInstallProgress: (cb: (progress: InstallProgress) => void) =>
      createEventListener<[InstallProgress]>("onboarding:install-progress", cb),
  },
  chat: {
    connect: (url?: string) => ipcRenderer.invoke("chat:connect", url),
    disconnect: () => ipcRenderer.invoke("chat:disconnect"),
    send: (request: ChatRequest) => ipcRenderer.invoke("chat:send", request),
    request: (method: string, params?: Record<string, unknown>) =>
      ipcRenderer.invoke("chat:request", method, params),
    isConnected: () => ipcRenderer.invoke("chat:isConnected"),
    onStream: (cb: (event: ChatStreamEvent) => void) =>
      createEventListener<[ChatStreamEvent]>("chat:stream", cb),
    onConnected: (cb: () => void) => createVoidListener("chat:connected", cb),
    onDisconnected: (cb: () => void) => createVoidListener("chat:disconnected", cb),
    onError: (cb: (error: string) => void) => createEventListener<[string]>("chat:error", cb),
    onNormalizedEvent: (cb: (event: ChatNormalizedRunEvent) => void) =>
      createEventListener<[ChatNormalizedRunEvent]>("chat:normalized-event", cb),
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
    setToolKey: (input: unknown) => ipcRenderer.invoke("credentials:set-tool-key", input),
    delete: (input: unknown) => ipcRenderer.invoke("credentials:delete", input),
    oauthDeviceStart: (provider: string) =>
      ipcRenderer.invoke("credentials:oauth-device-start", provider),
    oauthDevicePoll: (provider: string, deviceCode: string, interval: number) =>
      ipcRenderer.invoke("credentials:oauth-device-poll", provider, deviceCode, interval),
    oauthRefresh: (profileId: string) => ipcRenderer.invoke("credentials:oauth-refresh", profileId),
  },
  security: {
    get: (paths: string[]) => ipcRenderer.invoke("security:get", paths),
    apply: (ops: Array<{ path: string; value: unknown }>) =>
      ipcRenderer.invoke("security:apply", ops),
  },
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
  },
  workspace: {
    list: (subpath?: string) => ipcRenderer.invoke("workspace:list", subpath),
    readFile: (relativePath: string) => ipcRenderer.invoke("workspace:read-file", relativePath),
    readFileBase64: (relativePath: string) =>
      ipcRenderer.invoke("workspace:read-file-base64", relativePath),
    runPython: (relativePath: string) => ipcRenderer.invoke("workspace:run-python", relativePath),
    openInSystem: (relativePath: string) =>
      ipcRenderer.invoke("workspace:open-in-system", relativePath),
  },
  rescue: {
    gateway: {
      start: () => ipcRenderer.invoke("rescue:gateway-start"),
      stop: () => ipcRenderer.invoke("rescue:gateway-stop"),
      getStatus: () => ipcRenderer.invoke("rescue:gateway-status"),
      onStatusChange: (cb: (status: GatewayStatus) => void) =>
        createEventListener<[GatewayStatus]>("rescue:gateway-status-changed", cb),
    },
    chat: {
      connect: (url?: string) => ipcRenderer.invoke("rescue:connect", url),
      disconnect: () => ipcRenderer.invoke("rescue:disconnect"),
      send: (request: ChatRequest) => ipcRenderer.invoke("rescue:send", request),
      request: (method: string, params?: Record<string, unknown>) =>
        ipcRenderer.invoke("rescue:request", method, params),
      isConnected: () => ipcRenderer.invoke("rescue:isConnected"),
      onStream: (cb: (event: ChatStreamEvent) => void) =>
        createEventListener<[ChatStreamEvent]>("rescue:stream", cb),
      onConnected: (cb: () => void) => createVoidListener("rescue:connected", cb),
      onDisconnected: (cb: () => void) => createVoidListener("rescue:disconnected", cb),
      onError: (cb: (error: string) => void) => createEventListener<[string]>("rescue:error", cb),
    },
  },
});
