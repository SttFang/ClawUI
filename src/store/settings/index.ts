import { create } from 'zustand'
import { ipc } from '@/lib/ipc'

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
}

interface SettingsActions {
  loadSettings: () => Promise<void>
  setApiKey: (provider: keyof ApiKeys, key: string) => void
  saveApiKeys: () => Promise<void>
  setAutoStartGateway: (enabled: boolean) => Promise<void>
  setAutoCheckUpdates: (enabled: boolean) => Promise<void>
  clearSaveSuccess: () => void
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
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initialState,

  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await ipc.config.get()
      if (config) {
        set({
          apiKeys: {
            anthropic: config.providers?.anthropic?.apiKey || '',
            openai: config.providers?.openai?.apiKey || '',
            openrouter: config.providers?.openrouter?.apiKey || '',
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
      const providers: Record<string, { apiKey: string; baseUrl?: string }> = {}

      if (apiKeys.anthropic) {
        providers.anthropic = { apiKey: apiKeys.anthropic }
      }
      if (apiKeys.openai) {
        providers.openai = { apiKey: apiKeys.openai }
      }
      if (apiKeys.openrouter) {
        providers.openrouter = {
          apiKey: apiKeys.openrouter,
          baseUrl: 'https://openrouter.ai/api/v1',
        }
      }

      await ipc.config.set({ providers })
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
    // This would typically save to a local settings file
    // For now, we just update the state
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
