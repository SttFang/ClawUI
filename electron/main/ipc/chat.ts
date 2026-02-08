import { ipcMain, BrowserWindow } from 'electron'
import { chatWebSocket, ChatRequest, ChatStreamEvent } from '../services/chat-websocket'

export function registerChatHandlers(mainWindow: BrowserWindow): void {
  // Connect to WebSocket
  ipcMain.handle('chat:connect', async (_, url?: string) => {
    if (url) {
      chatWebSocket.setGatewayUrl(url)
    }
    await chatWebSocket.connect()
    return true
  })

  // Disconnect from WebSocket
  ipcMain.handle('chat:disconnect', async () => {
    chatWebSocket.disconnect()
    return true
  })

  // Send message
  ipcMain.handle('chat:send', async (_, request: ChatRequest) => {
    return chatWebSocket.sendMessage(request)
  })

  // Check connection status
  ipcMain.handle('chat:isConnected', () => {
    return chatWebSocket.isConnected()
  })

  // Forward stream events to renderer
  chatWebSocket.on('stream', (event: ChatStreamEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:stream', event)
    }
  })

  chatWebSocket.on('connected', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:connected')
    }
  })

  chatWebSocket.on('disconnected', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:disconnected')
    }
  })

  chatWebSocket.on('error', (error: string) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat:error', error)
    }
  })
}
