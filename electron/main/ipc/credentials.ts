import type {
  DeleteCredentialInput,
  SetChannelTokenInput,
  SetLlmKeyInput,
  SetProxyInput,
  SetToolKeyInput,
} from "@clawui/types/credentials";
import type { IpcMain } from "electron";
import type { CredentialService } from "../services/credential-service";

export function registerCredentialHandlers(
  ipcMain: IpcMain,
  credentialService: CredentialService,
): void {
  ipcMain.handle("credentials:list", async () => {
    return credentialService.getAllCredentials();
  });

  ipcMain.handle("credentials:set-llm-key", async (_event, input: SetLlmKeyInput) => {
    await credentialService.setLlmKey(input);
  });

  ipcMain.handle("credentials:validate", async (_event, provider: string, key: string) => {
    return credentialService.validateLlmKey(provider, key);
  });

  ipcMain.handle("credentials:set-channel", async (_event, input: SetChannelTokenInput) => {
    await credentialService.setChannelToken(input);
  });

  ipcMain.handle("credentials:set-proxy", async (_event, input: SetProxyInput) => {
    await credentialService.setProxy(input);
  });

  ipcMain.handle("credentials:set-tool-key", async (_event, input: SetToolKeyInput) => {
    await credentialService.setToolApiKey(input);
  });

  ipcMain.handle("credentials:delete", async (_event, input: DeleteCredentialInput) => {
    await credentialService.deleteCredential(input);
  });
}
