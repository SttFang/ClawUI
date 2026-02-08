import { IpcMain } from 'electron'
import { ConfigService, OpenClawConfig } from '../services/config'

export function registerConfigHandlers(ipcMain: IpcMain, configService: ConfigService): void {
  ipcMain.handle('config:get', async () => {
    return configService.getConfig()
  })

  ipcMain.handle('config:set', async (_event, config: Partial<OpenClawConfig>) => {
    await configService.setConfig(config)
  })

  ipcMain.handle('config:path', () => {
    return configService.getConfigPath()
  })
}
