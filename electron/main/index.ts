import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { app, shell, BrowserWindow, ipcMain, session } from "electron";
import { join } from "path";
import { registerAppHandlers } from "./ipc/app";
import { registerChatHandlers } from "./ipc/chat";
import { registerConfigHandlers } from "./ipc/config";
import { registerGatewayHandlers } from "./ipc/gateway";
import { registerMetadataHandlers } from "./ipc/metadata";
import { registerModelsHandlers } from "./ipc/models";
import { registerOnboardingHandlers } from "./ipc/onboarding";
import { registerProfilesHandlers } from "./ipc/profiles";
import { registerSecretsHandlers } from "./ipc/secrets";
import { registerSecurityHandlers } from "./ipc/security";
import { registerStateHandlers } from "./ipc/state";
import { registerUsageHandlers } from "./ipc/usage";
import { initLogger, mainLog } from "./lib/logger";
import { ClawUIStateService } from "./services/clawui-state";
import { GatewayService } from "./services/gateway";
import { OpenClawProfilesService } from "./services/openclaw-profiles";
import { UpdaterService } from "./services/updater";

// Initialise logging before anything else
initLogger();

// Services
const gatewayService = new GatewayService();
const profilesService = new OpenClawProfilesService();
const configService = profilesService.getConfigService("main");
const updaterService = new UpdaterService();
const clawUIStateService = new ClawUIStateService();

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // macOS: 隐藏标题栏但保留原生红绿灯
    titleBarStyle: "hiddenInset",
    // 红绿灯垂直居中公式: y = HEADER_HEIGHT / 2 - TRAFFIC_LIGHTS_HEIGHT / 2
    // h-11 = 44px, 红绿灯高度 = 14px, y = 44/2 - 14/2 = 22 - 7 = 15
    trafficLightPosition: { x: 20, y: 15 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith("https://") || details.url.startsWith("http://")) {
      shell.openExternal(details.url);
    } else {
      mainLog.warn("[window.blockedUrl]", details.url);
    }
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.clawui.app");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Set Content Security Policy
  // Dev mode needs 'unsafe-inline' for Vite HMR / React Fast Refresh preamble
  const scriptSrc = is.dev ? "'self' 'unsafe-inline'" : "'self'";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* ws://127.0.0.1:*; img-src 'self' data:; font-src 'self' data:`,
        ],
      },
    });
  });

  // Register IPC handlers
  registerGatewayHandlers(ipcMain, gatewayService, configService);
  registerConfigHandlers(ipcMain, configService);
  registerAppHandlers(ipcMain, updaterService);
  registerOnboardingHandlers();
  registerStateHandlers(ipcMain, clawUIStateService);
  registerModelsHandlers(ipcMain);
  registerProfilesHandlers(ipcMain, profilesService);
  registerMetadataHandlers(ipcMain, {
    stateService: clawUIStateService,
    profilesService,
    mainConfigService: configService,
  });
  registerSecretsHandlers(ipcMain, profilesService);
  registerSecurityHandlers(ipcMain);

  // Create the main window
  const mainWindow = createWindow();

  // Register chat handlers (needs mainWindow reference)
  registerChatHandlers(mainWindow, configService);
  registerUsageHandlers();

  // Initialize services
  try {
    await clawUIStateService.initialize();
    await profilesService.initialize();
    // Auto-start gateway if configured
    const config = await configService.getConfig();
    if (config) {
      gatewayService.setConfig({
        gateway: {
          port: config.gateway.port,
          bind: config.gateway.bind,
          auth: config.gateway.auth,
        },
        env: config.env,
      });
    }
  } catch (error) {
    mainLog.error("Failed to initialize services:", error);
  }

  // Set up updater
  updaterService.setWindow(mainWindow);
  try {
    const clawuiState = await clawUIStateService.get();
    if (clawuiState.app?.autoCheckUpdates !== false) {
      updaterService.checkForUpdates();
    }
  } catch {
    updaterService.checkForUpdates();
  }

  app.on("activate", function () {
    // On macOS re-create window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up on quit
app.on("before-quit", async () => {
  await gatewayService.dispose();
});
