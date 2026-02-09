import { ipcMain, BrowserWindow } from 'electron'
import { chatWebSocket, ChatRequest, ChatStreamEvent, type GatewayEventFrame } from '../services/chat-websocket'
import { ConfigService } from '../services/config'

export function registerChatHandlers(mainWindow: BrowserWindow, configService: ConfigService): void {
  async function ensureConnected(url?: string): Promise<void> {
    // Get token from config
    const config = await configService.getConfig()
    if (config?.gateway?.auth?.token) {
      chatWebSocket.setGatewayToken(config.gateway.auth.token)
    }
    if (url) {
      chatWebSocket.setGatewayUrl(url)
    } else if (config?.gateway?.port) {
      chatWebSocket.setGatewayUrl(`ws://127.0.0.1:${config.gateway.port}`)
    }
    if (!chatWebSocket.isConnected()) {
      await chatWebSocket.connect()
    }
  }

  // Connect to WebSocket
  ipcMain.handle('chat:connect', async (_, url?: string) => {
    await ensureConnected(url)
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

  // Generic ACP request (e.g. sessions.list / sessions.preview).
  ipcMain.handle(
    'chat:request',
    async (_, method: string, params?: Record<string, unknown>): Promise<unknown> => {
      await ensureConnected()
      return chatWebSocket.request(method, params)
    },
  )

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

  // Forward raw Gateway events to renderer (used by richer streaming transports / UI).
  chatWebSocket.on('gateway-event', (event: GatewayEventFrame) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway:event', event)
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
