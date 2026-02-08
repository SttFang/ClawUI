import { ipcMain } from 'electron'
import { runtimeDetector, RuntimeStatus } from '../services/runtime-detector'
import { installer, InstallProgress } from '../services/installer'
import {
  configurator,
  BYOKConfig,
  SubscriptionConfig,
} from '../services/configurator'

export function registerOnboardingHandlers(): void {
  // Detect runtime environment
  ipcMain.handle('onboarding:detect', async (): Promise<RuntimeStatus> => {
    return runtimeDetector.detect()
  })

  // Install runtime (Node.js + OpenClaw)
  ipcMain.handle('onboarding:install', async (event): Promise<void> => {
    const progressCallback = (progress: InstallProgress) => {
      event.sender.send('onboarding:install-progress', progress)
    }
    return installer.install(progressCallback)
  })

  // Uninstall runtime
  ipcMain.handle('onboarding:uninstall', async (): Promise<void> => {
    return installer.uninstall()
  })

  // Configure subscription mode
  ipcMain.handle(
    'onboarding:configure-subscription',
    async (_, config: SubscriptionConfig): Promise<void> => {
      return configurator.configureSubscription(config)
    }
  )

  // Configure BYOK mode
  ipcMain.handle(
    'onboarding:configure-byok',
    async (_, keys: BYOKConfig): Promise<void> => {
      return configurator.configureBYOK(keys)
    }
  )

  // Validate API key
  ipcMain.handle(
    'onboarding:validate-api-key',
    async (
      _,
      provider: 'anthropic' | 'openai',
      apiKey: string
    ): Promise<boolean> => {
      return configurator.validateApiKey(provider, apiKey)
    }
  )

  // Read current config
  ipcMain.handle('onboarding:read-config', async () => {
    return configurator.readConfig()
  })
}
