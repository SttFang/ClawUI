import { IpcMain } from 'electron'
import { ConfigService, OpenClawConfig } from '../services/config'
import { configLog } from '../lib/logger'

/** Only these top-level keys may be set from the renderer. */
const ALLOWED_CONFIG_KEYS: ReadonlySet<keyof OpenClawConfig> = new Set([
  'gateway',
  'agents',
  'session',
  'channels',
  'tools',
  'cron',
  'hooks',
])

function sanitizeConfigInput(raw: unknown): Partial<OpenClawConfig> | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (ALLOWED_CONFIG_KEYS.has(key as keyof OpenClawConfig)) {
      filtered[key] = value
    } else {
      configLog.warn('[config.set] rejected unknown key:', key)
    }
  }
  return Object.keys(filtered).length > 0 ? (filtered as Partial<OpenClawConfig>) : null
}

export function registerConfigHandlers(ipcMain: IpcMain, configService: ConfigService): void {
  ipcMain.handle('config:get', async () => {
    return configService.getConfig()
  })

  ipcMain.handle('config:set', async (_event, raw: unknown) => {
    const config = sanitizeConfigInput(raw)
    if (!config) {
      configLog.warn('[config.set] rejected invalid input')
      return
    }
    await configService.setConfig(config)
  })

  ipcMain.handle('config:path', () => {
    return configService.getConfigPath()
  })
}
