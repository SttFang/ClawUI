import { ipcMain } from 'electron'
import { chatWebSocket } from '../services/chat-websocket'

export function registerUsageHandlers(): void {
  ipcMain.handle('usage:sessions', async (_, params?: Record<string, unknown>) => {
    return chatWebSocket.request('sessions.usage', params)
  })

  ipcMain.handle('usage:cost', async (_, params?: Record<string, unknown>) => {
    return chatWebSocket.request('usage.cost', params)
  })

  ipcMain.handle('usage:timeseries', async (_, params?: Record<string, unknown>) => {
    return chatWebSocket.request('sessions.usage.timeseries', params)
  })

  ipcMain.handle('usage:logs', async (_, params?: Record<string, unknown>) => {
    return chatWebSocket.request('sessions.usage.logs', params)
  })
}
