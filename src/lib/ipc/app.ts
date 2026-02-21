import type { LoginCredentials, ClawUISessionMetadata } from "./types";
import { getElectronAPI } from "./types";

export const app = {
  async getVersion() {
    const api = getElectronAPI();
    return api?.app.getVersion() ?? "0.0.0";
  },
  async checkForUpdates() {
    const api = getElectronAPI();
    return api?.app.checkForUpdates() ?? null;
  },
  quitAndInstall() {
    const api = getElectronAPI();
    api?.app.quitAndInstall();
  },
  minimize() {
    const api = getElectronAPI();
    api?.app.minimize();
  },
  maximize() {
    const api = getElectronAPI();
    api?.app.maximize();
  },
  close() {
    const api = getElectronAPI();
    api?.app.close();
  },
};

export const metadata = {
  async generate(sessionKey: string): Promise<ClawUISessionMetadata> {
    const api = getElectronAPI();
    if (!api?.metadata) throw new Error("Metadata API not available — restart the app");
    return api.metadata.generate(sessionKey);
  },
};

export const subscription = {
  async login(credentials: LoginCredentials) {
    const api = getElectronAPI();
    return api?.subscription.login(credentials);
  },
  async logout() {
    const api = getElectronAPI();
    if (api) {
      await api.subscription.logout();
    }
  },
  async getStatus() {
    const api = getElectronAPI();
    return api?.subscription.getStatus();
  },
};
