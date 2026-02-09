import { create } from 'zustand'
import { ipc, getElectronAPI } from '@/lib/ipc'
import type { ModelsStatus } from '@clawui/types/models'

interface ApiKeys {
  anthropic: string
  openai: string
  openrouter: string
}

interface SettingsState {
  apiKeys: ApiKeys
  autoStartGateway: boolean
  autoCheckUpdates: boolean
  isLoading: boolean
  isSaving: boolean
  error: string | null
  saveSuccess: boolean
  modelsStatus: ModelsStatus | null
  modelsLoading: boolean
}

interface SettingsActions {
  loadSettings: () => Promise<void>
  setApiKey: (provider: keyof ApiKeys, key: string) => void
  saveApiKeys: () => Promise<void>
  setAutoStartGateway: (enabled: boolean) => Promise<void>
  setAutoCheckUpdates: (enabled: boolean) => Promise<void>
  clearSaveSuccess: () => void
  loadModelsStatus: () => Promise<void>
}

type SettingsStore = SettingsState & SettingsActions

const initialState: SettingsState = {
  apiKeys: {
    anthropic: '',
    openai: '',
    openrouter: '',
  },
  autoStartGateway: true,
  autoCheckUpdates: true,
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
  modelsStatus: null,
  modelsLoading: false,
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialState,

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await ipc.config.get()
      if (config) {
        // OpenClaw 2026 uses env vars for API keys
        const env = (config as { env?: Record<string, string> }).env || {}
        set({
          apiKeys: {
            anthropic: env.ANTHROPIC_API_KEY || '',
            openai: env.OPENAI_API_KEY || '',
            openrouter: env.OPENROUTER_API_KEY || '',
          },
          isLoading: false,
        })
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load settings'
      set({ error: message, isLoading: false })
    }
  },

  loadModelsStatus: async () => {
    set({ modelsLoading: true })
    try {
      const status = await ipc.models.status()
      set({ modelsStatus: status, modelsLoading: false })
    } catch {
      set({ modelsStatus: null, modelsLoading: false })
    }
  },

  setApiKey: (provider, key) => {
    set((state) => ({
      apiKeys: { ...state.apiKeys, [provider]: key },
      saveSuccess: false,
    }))
  },

  saveApiKeys: async () => {
    const { apiKeys } = get()
    set({ isSaving: true, error: null, saveSuccess: false })

    try {
      // OpenClaw 2026 uses environment variables for API keys, not "providers" key
      const env: Record<string, string> = {}

      if (apiKeys.anthropic) {
        env.ANTHROPIC_API_KEY = apiKeys.anthropic
      }
      if (apiKeys.openai) {
        env.OPENAI_API_KEY = apiKeys.openai
      }
      if (apiKeys.openrouter) {
        env.OPENROUTER_API_KEY = apiKeys.openrouter
      }

      // Check if Electron API is available
      if (!getElectronAPI()) {
        throw new Error('Electron API not available. Are you running in Electron?')
      }

      await ipc.config.set({ env })
      set({ isSaving: false, saveSuccess: true })

      // Clear success message after 3 seconds
      setTimeout(() => {
        set({ saveSuccess: false })
      }, 3000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save API keys'
      set({ error: message, isSaving: false })
    }
  },

  setAutoStartGateway: async (enabled) => {
    set({ autoStartGateway: enabled })
  },

  setAutoCheckUpdates: async (enabled) => {
    set({ autoCheckUpdates: enabled })
  },

  clearSaveSuccess: () => {
    set({ saveSuccess: false })
  },
}))

// Selectors
export const selectApiKeys = (state: SettingsStore) => state.apiKeys
export const selectAutoStartGateway = (state: SettingsStore) => state.autoStartGateway
export const selectAutoCheckUpdates = (state: SettingsStore) => state.autoCheckUpdates
export const selectIsLoading = (state: SettingsStore) => state.isLoading
export const selectIsSaving = (state: SettingsStore) => state.isSaving
export const selectError = (state: SettingsStore) => state.error
export const selectSaveSuccess = (state: SettingsStore) => state.saveSuccess
export const selectModelsStatus = (state: SettingsStore) => state.modelsStatus
export const selectModelsLoading = (state: SettingsStore) => state.modelsLoading
