import { ipcMain } from "electron";
import { configurator, BYOKConfig, SubscriptionConfig } from "../services/configurator";
import { installer, InstallProgress } from "../services/installer";
import { runtimeDetector, RuntimeStatus } from "../services/runtime-detector";

export function registerOnboardingHandlers(): void {
  // Detect runtime environment, then silently clean up version conflicts
  ipcMain.handle("onboarding:detect", async (): Promise<RuntimeStatus> => {
    const status = await runtimeDetector.detect();

    // If multiple installs exist and we have a compatible best version,
    // silently remove the stale ones so Gateway always uses the right binary.
    if (status.openclawConflict && status.openclawCompatible && status.openclawPath) {
      const stale = status.openclawInstalls.filter((i) => i.path !== status.openclawPath);
      if (stale.length > 0) {
        // Fire-and-forget: don't block startup
        installer.removeStaleInstalls(stale).catch(() => {});
      }
    }

    return status;
  });

  // Install runtime (Node.js + OpenClaw)
  ipcMain.handle("onboarding:install", async (event): Promise<void> => {
    const progressCallback = (progress: InstallProgress) => {
      event.sender.send("onboarding:install-progress", progress);
    };
    return installer.install(progressCallback);
  });

  // Uninstall runtime
  ipcMain.handle("onboarding:uninstall", async (): Promise<void> => {
    return installer.uninstall();
  });

  // Configure subscription mode
  ipcMain.handle(
    "onboarding:configure-subscription",
    async (_, config: SubscriptionConfig): Promise<void> => {
      return configurator.configureSubscription(config);
    },
  );

  // Configure BYOK mode
  ipcMain.handle("onboarding:configure-byok", async (_, keys: BYOKConfig): Promise<void> => {
    return configurator.configureBYOK(keys);
  });

  // Validate API key
  ipcMain.handle(
    "onboarding:validate-api-key",
    async (_, provider: "anthropic" | "openai", apiKey: string): Promise<boolean> => {
      return configurator.validateApiKey(provider, apiKey);
    },
  );

  // Read current config
  ipcMain.handle("onboarding:read-config", async () => {
    return configurator.readConfig();
  });
}
