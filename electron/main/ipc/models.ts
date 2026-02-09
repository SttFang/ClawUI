import { IpcMain } from 'electron'
import { execInLoginShell } from '../utils/login-shell'
import { mainLog } from '../lib/logger'
import type { ModelsStatus } from '@clawui/types'

export function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('models:status', async (): Promise<ModelsStatus | null> => {
    try {
      const { stdout } = await execInLoginShell('openclaw models status --json', {
        timeoutMs: 15_000,
      })
      const result = JSON.parse(stdout) as ModelsStatus
      mainLog.info('[models.status] loaded', {
        defaultModel: result.defaultModel,
        providers: result.auth.providers.length,
      })
      return result
    } catch (error) {
      mainLog.warn('[models.status] failed to load models status', error)
      return null
    }
  })
}
