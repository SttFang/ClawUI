import type {
  CredentialMeta,
  SetLlmKeyInput,
  SetChannelTokenInput,
  SetToolKeyInput,
  SetProxyInput,
  ValidateKeyResult,
  DeleteCredentialInput,
} from "./types";
import { getElectronAPI } from "./types";

export const credentials = {
  async list(): Promise<CredentialMeta[]> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    return api.credentials.list();
  },
  async setLlmKey(input: SetLlmKeyInput): Promise<void> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.setLlmKey(input);
  },
  async validate(provider: string, key: string): Promise<ValidateKeyResult> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    return api.credentials.validate(provider, key);
  },
  async setChannel(input: SetChannelTokenInput): Promise<void> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.setChannel(input);
  },
  async setProxy(input: SetProxyInput): Promise<void> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.setProxy(input);
  },
  async setToolKey(input: SetToolKeyInput): Promise<void> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.setToolKey(input);
  },
  async delete(input: DeleteCredentialInput): Promise<void> {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.delete(input);
  },
  async oauthDeviceStart(provider: string) {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    return api.credentials.oauthDeviceStart(provider);
  },
  async oauthDevicePoll(provider: string, deviceCode: string, interval: number) {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    return api.credentials.oauthDevicePoll(provider, deviceCode, interval);
  },
  async oauthRefresh(profileId: string) {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    return api.credentials.oauthRefresh(profileId);
  },
  async openCliLogin(command: string) {
    const api = getElectronAPI();
    if (!api?.credentials) throw new Error("Credentials API not available — restart the app");
    await api.credentials.openCliLogin(command);
  },
};

export const secrets = {
  async patch(patch: Record<string, unknown>): Promise<void> {
    const api = getElectronAPI();
    if (!api?.secrets) throw new Error("Secrets API not available — restart the app");
    await api.secrets.patch(patch);
  },
};

export const security = {
  async get(paths: string[]): Promise<Record<string, unknown>> {
    const api = getElectronAPI();
    if (!api?.security) throw new Error("Security API not available — restart the app");
    return api.security.get(paths);
  },
  async apply(ops: Array<{ path: string; value: unknown }>): Promise<void> {
    const api = getElectronAPI();
    if (!api?.security) throw new Error("Security API not available — restart the app");
    await api.security.apply(ops);
  },
};
