import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { GatewayService } from './services/gateway'
import { ConfigService } from './services/config'
import { UpdaterService } from './services/updater'
import { registerGatewayHandlers } from './ipc/gateway'
import { registerConfigHandlers } from './ipc/config'
import { registerAppHandlers } from './ipc/app'
import { registerOnboardingHandlers } from './ipc/onboarding'
import { registerChatHandlers } from './ipc/chat'

// Services
const gatewayService = new GatewayService()
const configService = new ConfigService()
const updaterService = new UpdaterService()

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // macOS: 隐藏标题栏但保留原生红绿灯
    titleBarStyle: 'hiddenInset',
    // 红绿灯垂直居中公式: y = HEADER_HEIGHT / 2 - TRAFFIC_LIGHTS_HEIGHT / 2
    // h-11 = 44px, 红绿灯高度 = 14px, y = 44/2 - 14/2 = 22 - 7 = 15
    trafficLightPosition: { x: 20, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.clawui.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerGatewayHandlers(ipcMain, gatewayService)
  registerConfigHandlers(ipcMain, configService)
  registerAppHandlers(ipcMain, updaterService)
  registerOnboardingHandlers()

  // Create the main window
  const mainWindow = createWindow()

  // Register chat handlers (needs mainWindow reference)
  registerChatHandlers(mainWindow)

  // Initialize services
  try {
    await configService.initialize()
    // Auto-start gateway if configured
    const config = await configService.getConfig()
    if (config) {
      gatewayService.setConfig({
        gateway: {
          port: config.gateway.port,
          bind: config.gateway.bind,
          auth: config.gateway.auth,
        },
        env: config.env,
      })
    }
  } catch (error) {
    console.error('Failed to initialize services:', error)
  }

  // Set up updater
  updaterService.setWindow(mainWindow)
  updaterService.checkForUpdates()

  app.on('activate', function () {
    // On macOS re-create window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up on quit
app.on('before-quit', async () => {
  await gatewayService.stop()
})
