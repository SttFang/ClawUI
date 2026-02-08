import { create } from 'zustand'
import { ipc, RuntimeStatus, InstallProgress } from '@/lib/ipc'
import type { OnboardingStep } from '@clawui/types/onboarding'

// Re-export the type for convenience
export type { OnboardingStep }

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
  reset: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

const initialState: OnboardingState = {
  step: 'checking',
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
    set({ isLoading: true, error: null, step: 'checking' })
    try {
      const status = await ipc.onboarding.detect()
      if (!status) {
        throw new Error('Failed to detect runtime')
      }
      set({ runtimeStatus: status, isLoading: false })

      // Simple flow: if not installed, show install; otherwise complete
      if (!status.nodeInstalled || !status.openclawInstalled) {
        set({ step: 'install' })
      } else {
        // OpenClaw is installed, go to chat page
        // Config check will be done in ChatPage
        set({ step: 'complete' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Detection failed'
      set({ error: message, isLoading: false, step: 'error' })
    }
  },

  startInstall: async () => {
    set({ isLoading: true, error: null, step: 'installing' })

    // Set up progress listener
    const removeListener = ipc.onboarding.onInstallProgress((progress) => {
      set({ installProgress: progress })

      if (progress.stage === 'complete') {
        set({ isLoading: false, step: 'complete' })
        removeListener()
      } else if (progress.stage === 'error') {
        set({
          isLoading: false,
          step: 'error',
          error: progress.error || 'Installation failed'
        })
        removeListener()
      }
    })

    try {
      await ipc.onboarding.install()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Installation failed'
      set({ error: message, isLoading: false, step: 'error' })
      removeListener()
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
