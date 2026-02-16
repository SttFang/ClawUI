import type {
  DeleteCredentialInput,
  SetChannelTokenInput,
  SetLlmKeyInput,
  SetProxyInput,
  SetToolKeyInput,
} from "@clawui/types/credentials";
import type { IpcMain } from "electron";
import type { CredentialService } from "../services/credential-service";
import type { OAuthService } from "../services/oauth-service";

export function registerCredentialHandlers(
  ipcMain: IpcMain,
  credentialService: CredentialService,
  oauthService?: OAuthService,
): void {
  ipcMain.handle("credentials:list", async () => {
    return credentialService.getAllCredentials();
  });

  ipcMain.handle("credentials:set-llm-key", async (_, input: SetLlmKeyInput) => {
    await credentialService.setLlmKey(input);
  });

  ipcMain.handle("credentials:validate", async (_, provider: string, key: string) => {
    return credentialService.validateLlmKey(provider, key);
  });

  ipcMain.handle("credentials:set-channel", async (_, input: SetChannelTokenInput) => {
    await credentialService.setChannelToken(input);
  });

  ipcMain.handle("credentials:set-proxy", async (_, input: SetProxyInput) => {
    await credentialService.setProxy(input);
  });

  ipcMain.handle("credentials:set-tool-key", async (_, input: SetToolKeyInput) => {
    await credentialService.setToolApiKey(input);
  });

  ipcMain.handle("credentials:delete", async (_, input: DeleteCredentialInput) => {
    await credentialService.deleteCredential(input);
  });

  // --- OAuth handlers ---

  ipcMain.handle("credentials:oauth-device-start", async (_, provider: string) => {
    if (!oauthService) throw new Error("OAuth service not available");
    return oauthService.startDeviceCodeFlow(provider);
  });

  ipcMain.handle(
    "credentials:oauth-device-poll",
    async (_, provider: string, deviceCode: string, interval: number) => {
      if (!oauthService) throw new Error("OAuth service not available");
      return oauthService.pollDeviceCodeToken(provider, deviceCode, interval);
    },
  );

  ipcMain.handle("credentials:oauth-refresh", async (_, profileId: string) => {
    if (!oauthService) throw new Error("OAuth service not available");
    return oauthService.refreshIfNeeded(profileId);
  });
}
