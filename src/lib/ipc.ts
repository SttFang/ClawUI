// IPC client for renderer process
// This module provides type-safe IPC communication with the main process

export interface ElectronAPI {
  gateway: {
    start: () => Promise<void>
    stop: () => Promise<void>
    getStatus: () => Promise<GatewayStatus>
    onStatusChange: (callback: (status: GatewayStatus) => void) => () => void
  }
  config: {
    get: () => Promise<OpenClawConfig>
    set: (config: Partial<OpenClawConfig>) => Promise<void>
    getPath: () => Promise<string>
  }
  subscription: {
    login: (credentials: LoginCredentials) => Promise<LoginResult>
    logout: () => Promise<void>
    getStatus: () => Promise<SubscriptionStatus>
  }
  app: {
    getVersion: () => Promise<string>
    checkForUpdates: () => Promise<UpdateInfo | null>
    quitAndInstall: () => void
    minimize: () => void
    maximize: () => void
    close: () => void
  }
}

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface OpenClawConfig {
  gateway: {
    port: number
    bind: string
    token: string
  }
  agents: {
    defaults: {
      workspace: string
      model: {
        primary: string
        fallbacks: string[]
      }
      sandbox: { enabled: boolean }
    }
  }
  session: {
    scope: 'per-sender' | 'per-channel-peer' | 'main'
    store: string
    reset: {
      mode: 'idle' | 'daily'
      idleMinutes: number
    }
  }
  channels: {
    telegram?: ChannelConfig
    discord?: ChannelConfig
    whatsapp?: ChannelConfig
    slack?: ChannelConfig
    [key: string]: ChannelConfig | undefined
  }
  tools: {
    access: 'auto' | 'ask' | 'deny'
    allow: string[]
    deny: string[]
    sandbox: { enabled: boolean }
  }
  providers: {
    anthropic?: { apiKey: string }
    openai?: { apiKey: string }
    openrouter?: { apiKey: string; baseUrl: string }
    [key: string]: { apiKey: string; baseUrl?: string } | undefined
  }
  env: Record<string, string>
  cron: {
    enabled: boolean
    store: string
  }
  hooks: {
    enabled: boolean
    token: string
    path: string
  }
}

export interface ChannelConfig {
  enabled: boolean
  botToken?: string
  appToken?: string
  dmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled'
  groupPolicy?: 'allowlist' | 'open' | 'disabled'
  requireMention?: boolean
  historyLimit?: number
  allowFrom?: string[]
  mediaMaxMb?: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResult {
  success: boolean
  error?: string
  token?: string
}

export interface SubscriptionStatus {
  isLoggedIn: boolean
  email?: string
  plan?: 'free' | 'pro' | 'team'
  expiresAt?: string
  usage?: {
    messages: number
    limit: number
  }
}

export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

// Get the electron API from the preload script
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electron' in window) {
    return (window as unknown as { electron: ElectronAPI }).electron
  }
  return null
}

// Typed IPC helpers
export const ipc = {
  gateway: {
    async start() {
      const api = getElectronAPI()
      if (api) {
        await api.gateway.start()
      }
    },
    async stop() {
      const api = getElectronAPI()
      if (api) {
        await api.gateway.stop()
      }
    },
    async getStatus() {
      const api = getElectronAPI()
      return api?.gateway.getStatus() ?? Promise.resolve('stopped' as const)
    },
    onStatusChange(callback: (status: GatewayStatus) => void) {
      const api = getElectronAPI()
      return api?.gateway.onStatusChange(callback) ?? (() => {})
    },
  },
  config: {
    async get() {
      const api = getElectronAPI()
      return api?.config.get()
    },
    async set(config: Partial<OpenClawConfig>) {
      const api = getElectronAPI()
      if (api) {
        await api.config.set(config)
      }
    },
    async getPath() {
      const api = getElectronAPI()
      return api?.config.getPath() ?? ''
    },
  },
  subscription: {
    async login(credentials: LoginCredentials) {
      const api = getElectronAPI()
      return api?.subscription.login(credentials)
    },
    async logout() {
      const api = getElectronAPI()
      if (api) {
        await api.subscription.logout()
      }
    },
    async getStatus() {
      const api = getElectronAPI()
      return api?.subscription.getStatus()
    },
  },
  app: {
    async getVersion() {
      const api = getElectronAPI()
      return api?.app.getVersion() ?? '0.0.0'
    },
    async checkForUpdates() {
      const api = getElectronAPI()
      return api?.app.checkForUpdates() ?? null
    },
    quitAndInstall() {
      const api = getElectronAPI()
      api?.app.quitAndInstall()
    },
    minimize() {
      const api = getElectronAPI()
      api?.app.minimize()
    },
    maximize() {
      const api = getElectronAPI()
      api?.app.maximize()
    },
    close() {
      const api = getElectronAPI()
      api?.app.close()
    },
  },
}
