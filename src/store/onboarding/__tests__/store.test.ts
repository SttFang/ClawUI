import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { RuntimeStatus, InstallProgress } from "@/lib/ipc";
import { useOnboardingStore } from "../index";

// Mock IPC
vi.mock("@/lib/ipc", () => ({
  ipc: {
    onboarding: {
      detect: vi.fn(),
      install: vi.fn(),
      onInstallProgress: vi.fn(() => () => {}),
    },
  },
}));

function mockStatus(overrides: Partial<RuntimeStatus> = {}): RuntimeStatus {
  return {
    nodeInstalled: true,
    nodeVersion: "22.0.0",
    nodePath: "/usr/local/bin/node",
    openclawInstalled: true,
    openclawVersion: "2026.2.9",
    openclawPath: "/usr/local/bin/openclaw",
    openclawCompatible: true,
    openclawNeedsUpgrade: false,
    openclawInstalls: [],
    openclawConflict: false,
    configExists: true,
    configValid: true,
    configPath: "~/.openclaw/openclaw.json",
    minRequiredVersion: "2026.2.9",
    openclawLatestVersion: null,
    openclawUpdateAvailable: false,
    ...overrides,
  };
}

const initialState = {
  step: "checking" as const,
  runtimeStatus: null,
  installProgress: null,
  isLoading: false,
  error: null,
};

describe("OnboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState(initialState);
    vi.clearAllMocks();
  });

  describe("setStep", () => {
    it("should update the current step", () => {
      const { setStep } = useOnboardingStore.getState();
      setStep("install");
      expect(useOnboardingStore.getState().step).toBe("install");
    });

    it("should allow setting any valid step", () => {
      const { setStep } = useOnboardingStore.getState();

      const steps = ["checking", "install", "upgrade", "installing", "complete", "error"] as const;

      for (const step of steps) {
        setStep(step);
        expect(useOnboardingStore.getState().step).toBe(step);
      }
    });
  });

  describe("setRuntimeStatus", () => {
    it("should update runtime status", () => {
      const { setRuntimeStatus } = useOnboardingStore.getState();
      const status = mockStatus();
      setRuntimeStatus(status);
      expect(useOnboardingStore.getState().runtimeStatus).toEqual(status);
    });
  });

  describe("setInstallProgress", () => {
    it("should update install progress", () => {
      const { setInstallProgress } = useOnboardingStore.getState();
      const progress: InstallProgress = {
        stage: "checking-requirements",
        progress: 50,
        message: "Checking Node.js/npm...",
      };

      setInstallProgress(progress);
      expect(useOnboardingStore.getState().installProgress).toEqual(progress);
    });
  });

  describe("setLoading", () => {
    it("should update loading state", () => {
      const { setLoading } = useOnboardingStore.getState();

      setLoading(true);
      expect(useOnboardingStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useOnboardingStore.getState().isLoading).toBe(false);
    });
  });

  describe("setError", () => {
    it("should update error state", () => {
      const { setError } = useOnboardingStore.getState();

      setError("Something went wrong");
      expect(useOnboardingStore.getState().error).toBe("Something went wrong");

      setError(null);
      expect(useOnboardingStore.getState().error).toBeNull();
    });
  });

  describe("detectRuntime", () => {
    it("should set step to complete when OpenClaw is installed and compatible", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(mockStatus());

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("complete");
      expect(state.isLoading).toBe(false);
    });

    it("should set step to upgrade when installed but version too old", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(
        mockStatus({
          openclawVersion: "2025.1.1",
          openclawCompatible: false,
          openclawNeedsUpgrade: true,
        }),
      );

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      expect(useOnboardingStore.getState().step).toBe("upgrade");
    });

    it("should set step to install when node not installed", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(
        mockStatus({
          nodeInstalled: false,
          nodeVersion: null,
          nodePath: null,
          openclawInstalled: false,
          openclawVersion: null,
          openclawPath: null,
          openclawCompatible: false,
          openclawNeedsUpgrade: false,
          configExists: false,
          configValid: false,
        }),
      );

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      expect(useOnboardingStore.getState().step).toBe("install");
    });

    it("should set step to install when openclaw not installed", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(
        mockStatus({
          openclawInstalled: false,
          openclawVersion: null,
          openclawPath: null,
          openclawCompatible: false,
          openclawNeedsUpgrade: false,
          configExists: false,
          configValid: false,
        }),
      );

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      expect(useOnboardingStore.getState().step).toBe("install");
    });

    it("should set step to complete when installed (config check happens in ChatPage)", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(mockStatus({ configValid: false }));

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      // Simplified flow: if installed + compatible, go to complete regardless of config
      expect(useOnboardingStore.getState().step).toBe("complete");
    });

    it("should handle detection error", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockRejectedValue(new Error("Detection failed"));

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("Detection failed");
      expect(state.isLoading).toBe(false);
    });

    it("should handle null detection result", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.detect as Mock).mockResolvedValue(null);

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("onboarding.errors.runtimeDetectFailed");
    });

    it("should set step to checking and loading to true at start", async () => {
      const { ipc } = await import("@/lib/ipc");

      let capturedState: { step: string; isLoading: boolean } | null = null;
      (ipc.onboarding.detect as Mock).mockImplementation(() => {
        capturedState = {
          step: useOnboardingStore.getState().step,
          isLoading: useOnboardingStore.getState().isLoading,
        };
        return Promise.resolve(mockStatus());
      });

      const { detectRuntime } = useOnboardingStore.getState();
      await detectRuntime();

      expect(capturedState).toEqual({ step: "checking", isLoading: true });
    });
  });

  describe("startInstall", () => {
    it("should set step to installing", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.install as Mock).mockResolvedValue(undefined);
      (ipc.onboarding.onInstallProgress as Mock).mockReturnValue(() => {});

      const { startInstall } = useOnboardingStore.getState();
      const installPromise = startInstall();

      expect(useOnboardingStore.getState().step).toBe("installing");
      expect(useOnboardingStore.getState().isLoading).toBe(true);

      await installPromise;
    });

    it("should handle progress callback for complete stage", async () => {
      const { ipc } = await import("@/lib/ipc");
      let progressCallback: ((progress: InstallProgress) => void) | null = null;
      (ipc.onboarding.onInstallProgress as Mock).mockImplementation((cb) => {
        progressCallback = cb;
        return () => {};
      });
      (ipc.onboarding.install as Mock).mockImplementation(() => {
        if (progressCallback) {
          progressCallback({
            stage: "complete",
            progress: 100,
            message: "Installation complete",
          });
        }
        return Promise.resolve();
      });

      const { startInstall } = useOnboardingStore.getState();
      await startInstall();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("complete");
      expect(state.isLoading).toBe(false);
    });

    it("should handle progress callback for error stage", async () => {
      const { ipc } = await import("@/lib/ipc");
      let progressCallback: ((progress: InstallProgress) => void) | null = null;
      (ipc.onboarding.onInstallProgress as Mock).mockImplementation((cb) => {
        progressCallback = cb;
        return () => {};
      });
      (ipc.onboarding.install as Mock).mockImplementation(() => {
        if (progressCallback) {
          progressCallback({
            stage: "error",
            progress: 0,
            message: "Installation failed",
            error: "Network error",
          });
        }
        return Promise.resolve();
      });

      const { startInstall } = useOnboardingStore.getState();
      await startInstall();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("Network error");
      expect(state.isLoading).toBe(false);
    });

    it("should handle install exception", async () => {
      const { ipc } = await import("@/lib/ipc");
      (ipc.onboarding.onInstallProgress as Mock).mockReturnValue(() => {});
      (ipc.onboarding.install as Mock).mockRejectedValue(new Error("Install crashed"));

      const { startInstall } = useOnboardingStore.getState();
      await startInstall();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("error");
      expect(state.error).toBe("Install crashed");
      expect(state.isLoading).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset store to initial state", () => {
      useOnboardingStore.setState({
        step: "complete",
        runtimeStatus: mockStatus(),
        isLoading: true,
        error: "Some error",
      });

      const { reset } = useOnboardingStore.getState();
      reset();

      const state = useOnboardingStore.getState();
      expect(state.step).toBe("checking");
      expect(state.runtimeStatus).toBeNull();
      expect(state.installProgress).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("selectors", () => {
    it("selectOnboardingStep should return current step", async () => {
      const { selectOnboardingStep } = await import("../index");
      useOnboardingStore.setState({ step: "install" });
      expect(selectOnboardingStep(useOnboardingStore.getState())).toBe("install");
    });

    it("selectRuntimeStatus should return runtime status", async () => {
      const { selectRuntimeStatus } = await import("../index");
      const status = mockStatus();
      useOnboardingStore.setState({ runtimeStatus: status });
      expect(selectRuntimeStatus(useOnboardingStore.getState())).toEqual(status);
    });

    it("selectInstallProgress should return install progress", async () => {
      const { selectInstallProgress } = await import("../index");
      const progress: InstallProgress = {
        stage: "checking-requirements",
        progress: 50,
        message: "Downloading...",
      };
      useOnboardingStore.setState({ installProgress: progress });
      expect(selectInstallProgress(useOnboardingStore.getState())).toEqual(progress);
    });

    it("selectIsLoading should return loading state", async () => {
      const { selectIsLoading } = await import("../index");
      useOnboardingStore.setState({ isLoading: true });
      expect(selectIsLoading(useOnboardingStore.getState())).toBe(true);
    });

    it("selectError should return error state", async () => {
      const { selectError } = await import("../index");
      useOnboardingStore.setState({ error: "Test error" });
      expect(selectError(useOnboardingStore.getState())).toBe("Test error");
    });
  });
});
