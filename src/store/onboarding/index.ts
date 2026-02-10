import type { OnboardingStep } from "@clawui/types/onboarding";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, RuntimeStatus, InstallProgress } from "@/lib/ipc";

// Re-export the type for convenience
export type { OnboardingStep };

interface OnboardingState {
  step: OnboardingStep;
  runtimeStatus: RuntimeStatus | null;
  installProgress: InstallProgress | null;
  isLoading: boolean;
  error: string | null;
}

interface OnboardingActions {
  setStep: (step: OnboardingStep) => void;
  setRuntimeStatus: (status: RuntimeStatus) => void;
  setInstallProgress: (progress: InstallProgress) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  detectRuntime: () => Promise<void>;
  startInstall: () => Promise<void>;
  reset: () => void;
}

type OnboardingStore = OnboardingState & OnboardingActions;

const ERR_RUNTIME_DETECT_FAILED = "onboarding.errors.runtimeDetectFailed";
const ERR_DETECTION_FAILED = "onboarding.errors.detectionFailed";
const ERR_INSTALL_FAILED = "onboarding.errors.installFailed";

const initialState: OnboardingState = {
  step: "checking",
  runtimeStatus: null,
  installProgress: null,
  isLoading: false,
  error: null,
};

export const useOnboardingStore = create<OnboardingStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ step }, false, "setStep"),
      setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }, false, "setRuntimeStatus"),
      setInstallProgress: (installProgress) =>
        set({ installProgress }, false, "setInstallProgress"),
      setLoading: (isLoading) => set({ isLoading }, false, "setLoading"),
      setError: (error) => set({ error }, false, "setError"),

      detectRuntime: async () => {
        set({ isLoading: true, error: null, step: "checking" }, false, "detectRuntime");
        try {
          const status = await ipc.onboarding.detect();
          if (!status) {
            throw new Error(ERR_RUNTIME_DETECT_FAILED);
          }
          set({ runtimeStatus: status, isLoading: false }, false, "detectRuntime/detected");

          if (!status.nodeInstalled || !status.openclawInstalled) {
            set({ step: "install" }, false, "detectRuntime/needsInstall");
          } else {
            set({ step: "complete" }, false, "detectRuntime/complete");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : ERR_DETECTION_FAILED;
          set({ error: message, isLoading: false, step: "error" }, false, "detectRuntime/error");
        }
      },

      startInstall: async () => {
        set({ isLoading: true, error: null, step: "installing" }, false, "startInstall");

        const removeListener = ipc.onboarding.onInstallProgress((progress) => {
          set({ installProgress: progress }, false, "startInstall/progress");

          if (progress.stage === "complete") {
            set({ isLoading: false, step: "complete" }, false, "startInstall/complete");
            removeListener();
          } else if (progress.stage === "error") {
            set(
              {
                isLoading: false,
                step: "error",
                error: progress.error || ERR_INSTALL_FAILED,
              },
              false,
              "startInstall/error",
            );
            removeListener();
          }
        });

        try {
          await ipc.onboarding.install();
        } catch (error) {
          const message = error instanceof Error ? error.message : ERR_INSTALL_FAILED;
          set({ error: message, isLoading: false, step: "error" }, false, "startInstall/catch");
          removeListener();
        }
      },

      reset: () => set(initialState, false, "reset"),
    }),
    { name: "OnboardingStore" },
  ),
);

// Selectors
export const selectOnboardingStep = (state: OnboardingStore) => state.step;
export const selectRuntimeStatus = (state: OnboardingStore) => state.runtimeStatus;
export const selectInstallProgress = (state: OnboardingStore) => state.installProgress;
export const selectIsLoading = (state: OnboardingStore) => state.isLoading;
export const selectError = (state: OnboardingStore) => state.error;

export const onboardingSelectors = {
  selectOnboardingStep,
  selectRuntimeStatus,
  selectInstallProgress,
  selectIsLoading,
  selectError,
};
