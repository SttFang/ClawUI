import type { ChatRequest, ChatStreamEvent, ChatNormalizedRunEvent } from "./types";
import { getElectronAPI } from "./types";

export const chat = {
  async connect(url?: string) {
    const api = getElectronAPI();
    return api?.chat.connect(url) ?? false;
  },
  async disconnect() {
    const api = getElectronAPI();
    return api?.chat.disconnect() ?? false;
  },
  async send(request: ChatRequest) {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.chat.send(request);
  },
  async request(method: string, params?: Record<string, unknown>) {
    const api = getElectronAPI();
    if (!api) throw new Error("Electron API not available");
    return api.chat.request(method, params);
  },
  async isConnected() {
    const api = getElectronAPI();
    return api?.chat.isConnected() ?? false;
  },
  onStream(callback: (event: ChatStreamEvent) => void) {
    const api = getElectronAPI();
    return api?.chat.onStream(callback) ?? (() => {});
  },
  onConnected(callback: () => void) {
    const api = getElectronAPI();
    return api?.chat.onConnected(callback) ?? (() => {});
  },
  onDisconnected(callback: () => void) {
    const api = getElectronAPI();
    return api?.chat.onDisconnected(callback) ?? (() => {});
  },
  onReconnected(callback: () => void) {
    const api = getElectronAPI();
    return api?.chat.onReconnected(callback) ?? (() => {});
  },
  onError(callback: (error: string) => void) {
    const api = getElectronAPI();
    return api?.chat.onError(callback) ?? (() => {});
  },
  onNormalizedEvent(callback: (event: ChatNormalizedRunEvent) => void) {
    const api = getElectronAPI();
    return api?.chat.onNormalizedEvent(callback) ?? (() => {});
  },
};
