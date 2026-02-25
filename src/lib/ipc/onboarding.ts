import type { RuntimeStatus, InstallProgress, SubscriptionConfig, BYOKConfig } from "./types";
import { getElectronAPI } from "./types";

function getBrowserFallbackRuntimeStatus(): RuntimeStatus {
  return {
    nodeInstalled: true,
    nodeVersion: null,
    nodePath: null,
    openclawInstalled: true,
    openclawVersion: null,
    openclawPath: null,
    openclawCompatible: true,
    openclawNeedsUpgrade: false,
    openclawInstalls: [],
    openclawConflict: false,
    configExists: true,
    configValid: true,
    configSchemaVersion: null,
    configPath: "",
    minRequiredVersion: "",
    openclawLatestVersion: null,
    openclawUpdateAvailable: false,
  };
}

export const onboarding = {
  async detect() {
    const api = getElectronAPI();
    if (api?.onboarding.detect) return api.onboarding.detect();
    // Browser renderer-only debug fallback:
    // keep app route available when preload bridge is absent.
    return getBrowserFallbackRuntimeStatus();
  },
  async install() {
    const api = getElectronAPI();
    if (api) {
      await api.onboarding.install();
    }
  },
  async uninstall() {
    const api = getElectronAPI();
    if (api) {
      await api.onboarding.uninstall();
    }
  },
  async configureSubscription(config: SubscriptionConfig) {
    const api = getElectronAPI();
    if (api) {
      await api.onboarding.configureSubscription(config);
    }
  },
  async configureBYOK(keys: BYOKConfig) {
    const api = getElectronAPI();
    if (api) {
      await api.onboarding.configureBYOK(keys);
    }
  },
  async validateApiKey(provider: "anthropic" | "openai", apiKey: string) {
    const api = getElectronAPI();
    return api?.onboarding.validateApiKey(provider, apiKey) ?? false;
  },
  async readConfig() {
    const api = getElectronAPI();
    return api?.onboarding.readConfig() ?? null;
  },
  onInstallProgress(callback: (progress: InstallProgress) => void) {
    const api = getElectronAPI();
    return api?.onboarding.onInstallProgress(callback) ?? (() => {});
  },
};
