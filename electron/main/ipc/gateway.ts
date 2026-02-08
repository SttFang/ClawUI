import { IpcMain, BrowserWindow } from 'electron'
import { GatewayService } from '../services/gateway'

export function registerGatewayHandlers(ipcMain: IpcMain, gateway: GatewayService): void {
  // Forward gateway status changes to all windows
  gateway.on('status-changed', (status) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('gateway:status-changed', status)
      }
    })
  })

  ipcMain.handle('gateway:start', async () => {
    await gateway.start()
  })

  ipcMain.handle('gateway:stop', async () => {
    await gateway.stop()
  })

  ipcMain.handle('gateway:status', () => {
    return gateway.getStatus()
  })

  ipcMain.handle('gateway:websocket-url', () => {
    return gateway.getWebSocketUrl()
  })
}
