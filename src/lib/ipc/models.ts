import type {
  ModelsStatusProbeOptions,
  ModelsStatus,
  ModelsCatalogResult,
  ModelsFallbacksResult,
  ModelsAuthOrderResult,
  ModelsAuthOrderInput,
  ModelsAuthOrderSetInput,
  ModelsAuthLoginOptions,
} from "./types";
import { getElectronAPI } from "./types";

export const models = {
  async status(options?: ModelsStatusProbeOptions): Promise<ModelsStatus | null> {
    const api = getElectronAPI();
    return api?.models.status(options) ?? null;
  },
  async list(): Promise<ModelsCatalogResult> {
    const api = getElectronAPI();
    if (!api?.models?.list) throw new Error("Models API not available — restart the app");
    return api.models.list();
  },
  async setDefault(model: string): Promise<void> {
    const api = getElectronAPI();
    if (!api?.models?.setDefault) throw new Error("Models API not available — restart the app");
    await api.models.setDefault(model);
  },
  async listFallbacks(): Promise<ModelsFallbacksResult> {
    const api = getElectronAPI();
    if (!api?.models?.listFallbacks) throw new Error("Models API not available — restart the app");
    return api.models.listFallbacks();
  },
  async addFallback(model: string): Promise<void> {
    const api = getElectronAPI();
    if (!api?.models?.addFallback) throw new Error("Models API not available — restart the app");
    await api.models.addFallback(model);
  },
  async removeFallback(model: string): Promise<void> {
    const api = getElectronAPI();
    if (!api?.models?.removeFallback) throw new Error("Models API not available — restart the app");
    await api.models.removeFallback(model);
  },
  async clearFallbacks(): Promise<void> {
    const api = getElectronAPI();
    if (!api?.models?.clearFallbacks) throw new Error("Models API not available — restart the app");
    await api.models.clearFallbacks();
  },
  async getAuthOrder(input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> {
    const api = getElectronAPI();
    if (!api?.models?.getAuthOrder) throw new Error("Models API not available — restart the app");
    return api.models.getAuthOrder(input);
  },
  async setAuthOrder(input: ModelsAuthOrderSetInput): Promise<ModelsAuthOrderResult> {
    const api = getElectronAPI();
    if (!api?.models?.setAuthOrder) throw new Error("Models API not available — restart the app");
    return api.models.setAuthOrder(input);
  },
  async clearAuthOrder(input: ModelsAuthOrderInput): Promise<ModelsAuthOrderResult> {
    const api = getElectronAPI();
    if (!api?.models?.clearAuthOrder) throw new Error("Models API not available — restart the app");
    return api.models.clearAuthOrder(input);
  },
  async authLogin(input?: ModelsAuthLoginOptions): Promise<{ ok: true; stdout: string }> {
    const api = getElectronAPI();
    if (!api?.models?.authLogin) throw new Error("Models API not available — restart the app");
    return api.models.authLogin(input);
  },
};
