import { BrowserWindow, app } from 'electron'
import electronUpdater, { type UpdateCheckResult } from 'electron-updater'

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
      console.log('[Updater] Checking for updates...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version)
      this.notifyWindow('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] No updates available')
    })

    autoUpdater.on('download-progress', (progress) => {
      console.log(`[Updater] Download progress: ${progress.percent}%`)
      this.notifyWindow('download-progress', progress)
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded:', info.version)
      this.notifyWindow('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('error', (error) => {
      console.error('[Updater] Error:', error)
    })
  }

  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
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
      console.error('[Updater] Check for updates failed:', error)
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
