import type { ChatRequest, ChatStreamEvent, GatewayStatus } from "./types";
import { getElectronAPI } from "./types";

export const rescue = {
  gateway: {
    async start() {
      const api = getElectronAPI();
      await api?.rescue?.gateway.start();
    },
    async stop() {
      const api = getElectronAPI();
      await api?.rescue?.gateway.stop();
    },
    async getStatus(): Promise<GatewayStatus> {
      const api = getElectronAPI();
      return api?.rescue?.gateway.getStatus() ?? Promise.resolve("stopped" as const);
    },
    onStatusChange(callback: (status: GatewayStatus) => void) {
      const api = getElectronAPI();
      return api?.rescue?.gateway.onStatusChange(callback) ?? (() => {});
    },
  },
  chat: {
    async connect(url?: string) {
      const api = getElectronAPI();
      return api?.rescue?.chat.connect(url) ?? false;
    },
    async disconnect() {
      const api = getElectronAPI();
      return api?.rescue?.chat.disconnect() ?? false;
    },
    async send(request: ChatRequest) {
      const api = getElectronAPI();
      if (!api?.rescue?.chat) throw new Error("Rescue API not available");
      return api.rescue.chat.send(request);
    },
    async request(method: string, params?: Record<string, unknown>) {
      const api = getElectronAPI();
      if (!api?.rescue?.chat) throw new Error("Rescue API not available");
      return api.rescue.chat.request(method, params);
    },
    async isConnected() {
      const api = getElectronAPI();
      return api?.rescue?.chat.isConnected() ?? false;
    },
    onStream(callback: (event: ChatStreamEvent) => void) {
      const api = getElectronAPI();
      return api?.rescue?.chat.onStream(callback) ?? (() => {});
    },
    onConnected(callback: () => void) {
      const api = getElectronAPI();
      return api?.rescue?.chat.onConnected(callback) ?? (() => {});
    },
    onDisconnected(callback: () => void) {
      const api = getElectronAPI();
      return api?.rescue?.chat.onDisconnected(callback) ?? (() => {});
    },
    onError(callback: (error: string) => void) {
      const api = getElectronAPI();
      return api?.rescue?.chat.onError(callback) ?? (() => {});
    },
  },
};
