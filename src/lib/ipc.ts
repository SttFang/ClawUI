// IPC client for renderer process
// This module provides type-safe IPC communication with the main process

// Import types from centralized package
import type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  SubscriptionConfig,
} from '@clawui/types/onboarding'
import type { ChatRequest, ChatStreamEvent } from '@clawui/types/chat'
import type { OpenClawConfig, OnboardingOpenClawConfig, ChannelConfig } from '@clawui/types/config'
import type { GatewayStatus, GatewayEventFrame } from '@clawui/types/gateway'
import type {
  LoginCredentials,
  LoginResult,
  SubscriptionStatus,
} from '@clawui/types/subscription'
import type { UpdateInfo } from '@clawui/types/app'
import type {
  SessionsUsageResult,
  CostUsageSummary,
  UsageTimeSeries,
} from '@clawui/types/usage'

// Re-export types for backward compatibility
export type {
  RuntimeStatus,
  InstallProgress,
  BYOKConfig,
  ChatRequest,
  ChatStreamEvent,
  OpenClawConfig,
  OnboardingOpenClawConfig,
  ChannelConfig,
  GatewayStatus,
  LoginCredentials,
  LoginResult,
  SubscriptionStatus,
  UpdateInfo,
}

// Alias for backward compatibility
export type OnboardingSubscriptionConfig = SubscriptionConfig

export interface ElectronAPI {
  gateway: {
    start: () => Promise<void>
    stop: () => Promise<void>
    getStatus: () => Promise<GatewayStatus>
    onStatusChange: (callback: (status: GatewayStatus) => void) => () => void
    onEvent: (callback: (event: GatewayEventFrame) => void) => () => void
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
  onboarding: {
    detect: () => Promise<RuntimeStatus>
    install: () => Promise<void>
    uninstall: () => Promise<void>
    configureSubscription: (config: SubscriptionConfig) => Promise<void>
    configureBYOK: (keys: BYOKConfig) => Promise<void>
    validateApiKey: (
      provider: 'anthropic' | 'openai',
      apiKey: string
    ) => Promise<boolean>
    readConfig: () => Promise<OnboardingOpenClawConfig | null>
    onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void
  }
  chat: {
    connect: (url?: string) => Promise<boolean>
    disconnect: () => Promise<boolean>
    send: (request: ChatRequest) => Promise<string>
    isConnected: () => Promise<boolean>
    onStream: (callback: (event: ChatStreamEvent) => void) => () => void
    onConnected: (callback: () => void) => () => void
    onDisconnected: (callback: () => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  usage: {
    sessions: (params?: Record<string, unknown>) => Promise<SessionsUsageResult>
    cost: (params?: Record<string, unknown>) => Promise<CostUsageSummary>
    timeseries: (params?: Record<string, unknown>) => Promise<UsageTimeSeries>
    logs: (params?: Record<string, unknown>) => Promise<unknown>
  }
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
    onEvent(callback: (event: GatewayEventFrame) => void) {
      const api = getElectronAPI()
      return api?.gateway.onEvent(callback) ?? (() => {})
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
  onboarding: {
    async detect() {
      const api = getElectronAPI()
      return api?.onboarding.detect()
    },
    async install() {
      const api = getElectronAPI()
      if (api) {
        await api.onboarding.install()
      }
    },
    async uninstall() {
      const api = getElectronAPI()
      if (api) {
        await api.onboarding.uninstall()
      }
    },
    async configureSubscription(config: SubscriptionConfig) {
      const api = getElectronAPI()
      if (api) {
        await api.onboarding.configureSubscription(config)
      }
    },
    async configureBYOK(keys: BYOKConfig) {
      const api = getElectronAPI()
      if (api) {
        await api.onboarding.configureBYOK(keys)
      }
    },
    async validateApiKey(provider: 'anthropic' | 'openai', apiKey: string) {
      const api = getElectronAPI()
      return api?.onboarding.validateApiKey(provider, apiKey) ?? false
    },
    async readConfig() {
      const api = getElectronAPI()
      return api?.onboarding.readConfig() ?? null
    },
    onInstallProgress(callback: (progress: InstallProgress) => void) {
      const api = getElectronAPI()
      return api?.onboarding.onInstallProgress(callback) ?? (() => {})
    },
  },
  chat: {
    async connect(url?: string) {
      const api = getElectronAPI()
      return api?.chat.connect(url) ?? false
    },
    async disconnect() {
      const api = getElectronAPI()
      return api?.chat.disconnect() ?? false
    },
    async send(request: ChatRequest) {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API not available')
      return api.chat.send(request)
    },
    async isConnected() {
      const api = getElectronAPI()
      return api?.chat.isConnected() ?? false
    },
    onStream(callback: (event: ChatStreamEvent) => void) {
      const api = getElectronAPI()
      return api?.chat.onStream(callback) ?? (() => {})
    },
    onConnected(callback: () => void) {
      const api = getElectronAPI()
      return api?.chat.onConnected(callback) ?? (() => {})
    },
    onDisconnected(callback: () => void) {
      const api = getElectronAPI()
      return api?.chat.onDisconnected(callback) ?? (() => {})
    },
    onError(callback: (error: string) => void) {
      const api = getElectronAPI()
      return api?.chat.onError(callback) ?? (() => {})
    },
  },
  usage: {
    async sessions(params?: Record<string, unknown>) {
      const api = getElectronAPI()
      if (!api?.usage) throw new Error('Usage API not available — restart the app')
      return api.usage.sessions(params)
    },
    async cost(params?: Record<string, unknown>) {
      const api = getElectronAPI()
      if (!api?.usage) throw new Error('Usage API not available — restart the app')
      return api.usage.cost(params)
    },
    async timeseries(params?: Record<string, unknown>) {
      const api = getElectronAPI()
      if (!api?.usage) throw new Error('Usage API not available — restart the app')
      return api.usage.timeseries(params)
    },
    async logs(params?: Record<string, unknown>) {
      const api = getElectronAPI()
      if (!api?.usage) throw new Error('Usage API not available — restart the app')
      return api.usage.logs(params)
    },
  },
}
