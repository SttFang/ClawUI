import { getElectronAPI } from "./types";

export const usage = {
  async sessions(params?: Record<string, unknown>) {
    const api = getElectronAPI();
    if (!api?.usage) throw new Error("Usage API not available — restart the app");
    return api.usage.sessions(params);
  },
  async cost(params?: Record<string, unknown>) {
    const api = getElectronAPI();
    if (!api?.usage) throw new Error("Usage API not available — restart the app");
    return api.usage.cost(params);
  },
  async timeseries(params?: Record<string, unknown>) {
    const api = getElectronAPI();
    if (!api?.usage) throw new Error("Usage API not available — restart the app");
    return api.usage.timeseries(params);
  },
  async logs(params?: Record<string, unknown>) {
    const api = getElectronAPI();
    if (!api?.usage) throw new Error("Usage API not available — restart the app");
    return api.usage.logs(params);
  },
};
