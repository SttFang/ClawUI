import type { ConfigSetDraftInputV2, DeepPartial, ClawUIState } from "./types";
import { getElectronAPI } from "./types";

export const config = {
  async getSnapshot() {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.config.getSnapshot();
  },
  async getSchema() {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.config.getSchema();
  },
  async setDraft(input: ConfigSetDraftInputV2) {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    const result = await api.config.setDraft(input);
    if (!result.ok) {
      const error = new Error(result.error.message) as Error & { code?: string };
      error.code = result.error.code;
      throw error;
    }
    return result;
  },
  async getPath() {
    const api = getElectronAPI();
    return api?.config.getPath() ?? "";
  },
};

export const profiles = {
  async ensure() {
    const api = getElectronAPI();
    if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
    return api.profiles.ensure();
  },
  async patchEnvBoth(patch: Record<string, string | null | undefined>) {
    const api = getElectronAPI();
    if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
    await api.profiles.patchEnvBoth(patch);
  },
  async getConfigPath(profileId: "main" | "configAgent") {
    const api = getElectronAPI();
    if (!api?.profiles) throw new Error("Profiles API not available — restart the app");
    return api.profiles.getConfigPath(profileId);
  },
};

export const state = {
  async get() {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.state.get();
  },
  async patch(partial: DeepPartial<ClawUIState>) {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.state.patch(partial);
  },
  async getPath() {
    const api = getElectronAPI();
    return api?.state.getPath() ?? "";
  },
};
