import { BrowserWindow, app } from 'electron'
import electronUpdater, { type UpdateCheckResult } from 'electron-updater'
import { updaterLog } from '../lib/logger'

const { autoUpdater } = electronUpdater

export interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

export class UpdaterService {
  private window: BrowserWindow | null = null

  constructor() {
    // Configure auto-updater
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // Set up event handlers
    autoUpdater.on('checking-for-update', () => {
      updaterLog.info('[updater.checking]')
    })

    autoUpdater.on('update-available', (info) => {
      updaterLog.info('[updater.available]', `version=${info.version}`)
      this.notifyWindow('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('update-not-available', () => {
      updaterLog.info('[updater.up-to-date]')
    })

    autoUpdater.on('download-progress', (progress) => {
      updaterLog.info('[updater.downloading]', `progress=${Math.round(progress.percent)}%`)
      this.notifyWindow('download-progress', progress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      updaterLog.info('[updater.downloaded]', `version=${info.version}`)
      this.notifyWindow('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('error', (error) => {
      updaterLog.error('[updater.error]', error)
    })
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    const t0 = Date.now()
    try {
      const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        return {
          version: result.updateInfo.version,
          releaseNotes: Array.isArray(result.updateInfo.releaseNotes)
            ? result.updateInfo.releaseNotes.map((n) => n.note || n).join('\n')
            : (result.updateInfo.releaseNotes as string | undefined),
          releaseDate: result.updateInfo.releaseDate,
        }
      }
      return null
    } catch (error) {
      updaterLog.error('[updater.check.failed]', error, `durationMs=${Date.now() - t0}`)
      return null
    }
  }

  async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate()
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }

  getVersion(): string {
    return app.getVersion()
  }

  private notifyWindow(event: string, data: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(`updater:${event}`, data)
    }
  }
}
