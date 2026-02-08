import { create } from 'zustand'
import { ipc, RuntimeStatus, InstallProgress } from '@/lib/ipc'

export type OnboardingStep =
  | 'login'
  | 'detecting'
  | 'install-required'
  | 'installing'
  | 'config-mode'
  | 'config-subscription'
  | 'config-byok'
  | 'complete'

interface OnboardingState {
  step: OnboardingStep
  runtimeStatus: RuntimeStatus | null
  installProgress: InstallProgress | null
  isLoading: boolean
  error: string | null
}

interface OnboardingActions {
  setStep: (step: OnboardingStep) => void
  setRuntimeStatus: (status: RuntimeStatus) => void
  setInstallProgress: (progress: InstallProgress) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  detectRuntime: () => Promise<void>
  startInstall: () => Promise<void>
  configureSubscription: (proxyUrl: string, proxyToken: string) => Promise<void>
  configureBYOK: (anthropicKey?: string, openaiKey?: string) => Promise<void>
  validateApiKey: (provider: 'anthropic' | 'openai', key: string) => Promise<boolean>
  reset: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

const initialState: OnboardingState = {
  step: 'login',
  runtimeStatus: null,
  installProgress: null,
  isLoading: false,
  error: null,
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...initialState,

  setStep: (step) => set({ step }),
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
  setInstallProgress: (installProgress) => set({ installProgress }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  detectRuntime: async () => {
    set({ isLoading: true, error: null, step: 'detecting' })
    try {
      const status = await ipc.onboarding.detect()
      if (!status) {
        throw new Error('Failed to detect runtime')
      }
      set({ runtimeStatus: status, isLoading: false })

      // Determine next step based on status
      if (status.configValid) {
        set({ step: 'complete' })
      } else if (!status.nodeInstalled || !status.openclawInstalled) {
        set({ step: 'install-required' })
      } else {
        set({ step: 'config-mode' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed'
      set({ error: message, isLoading: false, step: 'login' })
    }
  },

  startInstall: async () => {
    set({ isLoading: true, error: null, step: 'installing' })

    // Set up progress listener
    const removeListener = ipc.onboarding.onInstallProgress((progress) => {
      set({ installProgress: progress })

      if (progress.stage === 'complete') {
        set({ isLoading: false, step: 'config-mode' })
        removeListener()
      } else if (progress.stage === 'error') {
        set({ isLoading: false, error: progress.error || 'Installation failed' })
        removeListener()
      }
    })

    try {
      await ipc.onboarding.install()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Installation failed'
      set({ error: message, isLoading: false })
      removeListener()
    }
  },

  configureSubscription: async (proxyUrl, proxyToken) => {
    set({ isLoading: true, error: null })
    try {
      await ipc.onboarding.configureSubscription({ proxyUrl, proxyToken })
      set({ isLoading: false, step: 'complete' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed'
      set({ error: message, isLoading: false })
    }
  },

  configureBYOK: async (anthropicKey, openaiKey) => {
    set({ isLoading: true, error: null })
    try {
      await ipc.onboarding.configureBYOK({
        anthropic: anthropicKey,
        openai: openaiKey,
      })
      set({ isLoading: false, step: 'complete' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration failed'
      set({ error: message, isLoading: false })
    }
  },

  validateApiKey: async (provider, key) => {
    try {
      return await ipc.onboarding.validateApiKey(provider, key)
    } catch {
      return false
    }
  },

  reset: () => set(initialState),
}))

// Selectors
export const selectOnboardingStep = (state: OnboardingStore) => state.step
export const selectRuntimeStatus = (state: OnboardingStore) => state.runtimeStatus
export const selectInstallProgress = (state: OnboardingStore) => state.installProgress
export const selectIsLoading = (state: OnboardingStore) => state.isLoading
export const selectError = (state: OnboardingStore) => state.error
