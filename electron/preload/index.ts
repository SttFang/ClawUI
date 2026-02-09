import { contextBridge, ipcRenderer } from 'electron'

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface GatewayEventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: number
}

export interface InstallProgress {
  stage:
    | 'checking-requirements'
    | 'installing-openclaw'
    | 'verifying'
    | 'complete'
    | 'error'
  progress: number
  message: string
  error?: string
}

export interface RuntimeStatus {
  nodeInstalled: boolean
  nodeVersion: string | null
  nodePath: string | null
  openclawInstalled: boolean
  openclawVersion: string | null
  openclawPath: string | null
  configExists: boolean
  configValid: boolean
  configPath: string
}

export interface BYOKConfig {
  anthropic?: string
  openai?: string
}

export interface SubscriptionConfig {
  proxyUrl: string
  proxyToken: string
}

export interface ChatRequest {
  sessionId: string
  message: string
  model?: string
}

export interface ChatStreamEvent {
  type: 'start' | 'delta' | 'end' | 'error'
  sessionId: string
  messageId: string
  content?: string
  error?: string
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  gateway: {
    start: () => ipcRenderer.invoke('gateway:start'),
    stop: () => ipcRenderer.invoke('gateway:stop'),
    getStatus: () => ipcRenderer.invoke('gateway:status'),
    onStatusChange: (callback: (status: GatewayStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: GatewayStatus) => callback(status)
      ipcRenderer.on('gateway:status-changed', listener)
      return () => {
        ipcRenderer.removeListener('gateway:status-changed', listener)
      }
    },
    onEvent: (callback: (event: GatewayEventFrame) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, evt: GatewayEventFrame) => callback(evt)
      ipcRenderer.on('gateway:event', listener)
      return () => {
        ipcRenderer.removeListener('gateway:event', listener)
      }
    },
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: unknown) => ipcRenderer.invoke('config:set', config),
    getPath: () => ipcRenderer.invoke('config:path'),
  },
  subscription: {
    login: (credentials: { email: string; password: string }) =>
      ipcRenderer.invoke('subscription:login', credentials),
    logout: () => ipcRenderer.invoke('subscription:logout'),
    getStatus: () => ipcRenderer.invoke('subscription:status'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
    quitAndInstall: () => ipcRenderer.send('app:quit-and-install'),
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    close: () => ipcRenderer.send('app:close'),
  },
  onboarding: {
    detect: () => ipcRenderer.invoke('onboarding:detect'),
    install: () => ipcRenderer.invoke('onboarding:install'),
    uninstall: () => ipcRenderer.invoke('onboarding:uninstall'),
    configureSubscription: (config: SubscriptionConfig) =>
      ipcRenderer.invoke('onboarding:configure-subscription', config),
    configureBYOK: (keys: BYOKConfig) =>
      ipcRenderer.invoke('onboarding:configure-byok', keys),
    validateApiKey: (provider: 'anthropic' | 'openai', apiKey: string) =>
      ipcRenderer.invoke('onboarding:validate-api-key', provider, apiKey),
    readConfig: () => ipcRenderer.invoke('onboarding:read-config'),
    onInstallProgress: (callback: (progress: InstallProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: InstallProgress) =>
        callback(progress)
      ipcRenderer.on('onboarding:install-progress', listener)
      return () => {
        ipcRenderer.removeListener('onboarding:install-progress', listener)
      }
    },
  },
  chat: {
    connect: (url?: string) => ipcRenderer.invoke('chat:connect', url),
    disconnect: () => ipcRenderer.invoke('chat:disconnect'),
    send: (request: ChatRequest) => ipcRenderer.invoke('chat:send', request),
    isConnected: () => ipcRenderer.invoke('chat:isConnected'),
    onStream: (callback: (event: ChatStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ChatStreamEvent) => callback(data)
      ipcRenderer.on('chat:stream', listener)
      return () => ipcRenderer.removeListener('chat:stream', listener)
    },
    onConnected: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('chat:connected', listener)
      return () => ipcRenderer.removeListener('chat:connected', listener)
    },
    onDisconnected: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('chat:disconnected', listener)
      return () => ipcRenderer.removeListener('chat:disconnected', listener)
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('chat:error', listener)
      return () => ipcRenderer.removeListener('chat:error', listener)
    },
  },
})
