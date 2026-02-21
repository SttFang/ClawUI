import type { GatewayStatus, GatewayEventFrame } from "./types";
import { getElectronAPI } from "./types";

export const gateway = {
  async start() {
    const api = getElectronAPI();
    if (api) {
      await api.gateway.start();
    }
  },
  async stop() {
    const api = getElectronAPI();
    if (api) {
      await api.gateway.stop();
    }
  },
  async getStatus() {
    const api = getElectronAPI();
    return api?.gateway.getStatus() ?? Promise.resolve("stopped" as const);
  },
  async installService() {
    const api = getElectronAPI();
    if (!api?.gateway.installService)
      throw new Error("Gateway install API not available — restart the app");
    await api.gateway.installService();
  },
  async restartService() {
    const api = getElectronAPI();
    if (!api?.gateway.restartService)
      throw new Error("Gateway restart API not available — restart the app");
    await api.gateway.restartService();
  },
  async uninstallService() {
    const api = getElectronAPI();
    if (!api?.gateway.uninstallService)
      throw new Error("Gateway uninstall API not available — restart the app");
    await api.gateway.uninstallService();
  },
  onStatusChange(callback: (status: GatewayStatus) => void) {
    const api = getElectronAPI();
    return api?.gateway.onStatusChange(callback) ?? (() => {});
  },
  onEvent(callback: (event: GatewayEventFrame) => void) {
    const api = getElectronAPI();
    return api?.gateway.onEvent(callback) ?? (() => {});
  },
};
