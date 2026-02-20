import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain, session } from "electron";
import { CONFIG_AGENT_PROFILE_NAME } from "./constants";
import { registerAppHandlers } from "./ipc/app";
import { registerChatHandlers } from "./ipc/chat";
import { registerConfigHandlers } from "./ipc/config";
import { registerCredentialHandlers } from "./ipc/credentials";
import { forwardToWindow } from "./ipc/forward";
import { registerGatewayHandlers } from "./ipc/gateway";
import { registerMetadataHandlers } from "./ipc/metadata";
import { registerModelsHandlers } from "./ipc/models";
import { registerOnboardingHandlers } from "./ipc/onboarding";
import { registerProfilesHandlers } from "./ipc/profiles";
import { registerRescueHandlers } from "./ipc/rescue";
import { registerSecretsHandlers } from "./ipc/secrets";
import { registerSecurityHandlers } from "./ipc/security";
import { registerSkillsHandlers } from "./ipc/skills";
import { registerStateHandlers } from "./ipc/state";
import { registerUsageHandlers } from "./ipc/usage";
import { registerWorkspaceHandlers } from "./ipc/workspace";
import { initLogger, mainLog } from "./lib/logger";
import { ChatWebSocketService } from "./services/chat-websocket";
import { ClawUIStateService } from "./services/clawui-state";
import { ConfigOrchestrator } from "./services/config";
import { configurator } from "./services/configurator";
import { CredentialService } from "./services/credentials";
import { OAuthService } from "./services/credentials";
import { GatewayService } from "./services/gateway";
import { OpenClawProfilesService } from "./services/openclaw-profiles";
import { UpdaterService } from "./services/updater";
import { createMainWindow } from "./window/create-main-window";

// Initialise logging before anything else
initLogger();

// Services
const chatWebSocket = new ChatWebSocketService();
const gatewayService = new GatewayService();
const rescueChatWs = new ChatWebSocketService();
const rescueGateway = new GatewayService({ profile: CONFIG_AGENT_PROFILE_NAME });
const profilesService = new OpenClawProfilesService();
const configService = profilesService.getConfigService("main");
const configOrchestrator = new ConfigOrchestrator({
  configPath: configService.getConfigPath(),
  configService,
  chatWebSocket,
});
const updaterService = new UpdaterService();
const clawUIStateService = new ClawUIStateService();
const credentialService = new CredentialService(configService);
const oauthService = new OAuthService(credentialService.getAuthProfileAdapter());

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
  // Streamdown code highlighting uses Shiki/Oniguruma (WASM). Allow WASM eval without enabling full 'unsafe-eval'.
  const scriptSrc = is.dev
    ? "'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "'self' 'wasm-unsafe-eval'";
  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `connect-src 'self' ws://localhost:* ws://127.0.0.1:*`,
    `img-src 'self' data:`,
    `media-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `frame-src blob: 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // Register IPC handlers
  registerGatewayHandlers(ipcMain, gatewayService, configService);
  registerConfigHandlers(ipcMain, configOrchestrator, configService.getConfigPath());
  registerAppHandlers(ipcMain, updaterService);
  registerOnboardingHandlers();
  registerStateHandlers(ipcMain, clawUIStateService);
  registerModelsHandlers(ipcMain);
  registerProfilesHandlers(ipcMain, profilesService);
  registerMetadataHandlers(ipcMain, {
    stateService: clawUIStateService,
    profilesService,
    mainConfigService: configService,
    chatWebSocket,
  });
  registerSecretsHandlers(ipcMain, profilesService, credentialService);
  registerSecurityHandlers(ipcMain);
  registerSkillsHandlers(ipcMain, profilesService);
  registerCredentialHandlers(ipcMain, credentialService, oauthService);
  registerWorkspaceHandlers(ipcMain, configService);
  registerRescueHandlers(
    rescueGateway,
    rescueChatWs,
    profilesService.getConfigService("configAgent"),
  );

  // Create the main window
  const mainWindow = createMainWindow({
    isDev: is.dev,
    rendererUrl: process.env["ELECTRON_RENDERER_URL"],
  });

  // Register chat handlers (needs mainWindow reference)
  chatWebSocket.setClientVersion(app.getVersion());
  registerChatHandlers(mainWindow, configService, chatWebSocket);
  registerUsageHandlers(configService, chatWebSocket);

  // Critical initialization — app cannot function without these
  try {
    await clawUIStateService.initialize();
    await profilesService.initialize();
    await credentialService.initialize();
    configurator.setCredentialService(credentialService);
  } catch (error) {
    mainLog.error("[init.critical.failed]", error);
    const { dialog: d } = await import("electron");
    d.showErrorBox("Initialization Failed", String(error));
    app.exit(1);
  }

  // Non-critical initialization — warn and degrade gracefully
  try {
    const config = await configService.getConfig();
    if (config) gatewayService.setConfig(config);
    const rescueConfig = await profilesService.getConfigService("configAgent").getConfig();
    if (rescueConfig) rescueGateway.setConfig(rescueConfig);
  } catch (error) {
    mainLog.warn("[init.gateway-config.degraded]", error);
  }

  // Set up updater
  updaterService.setWindow(mainWindow);
  try {
    const clawuiState = await clawUIStateService.get();
    if (clawuiState.app?.autoCheckUpdates !== false) {
      updaterService.checkForUpdates();
    }
  } catch (error) {
    mainLog.warn("[init.updater.skipped]", error);
  }

  app.on("activate", () => {
    // On macOS re-create window when dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createMainWindow({
        isDev: is.dev,
        rendererUrl: process.env["ELECTRON_RENDERER_URL"],
      });
      updaterService.setWindow(win);
      forwardToWindow(chatWebSocket, win, {
        stream: "chat:stream",
        "gateway-event": "gateway:event",
        "normalized-event": "chat:normalized-event",
        connected: "chat:connected",
        disconnected: "chat:disconnected",
        error: "chat:error",
      });
    }
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
  await Promise.all([gatewayService.dispose(), rescueGateway.dispose()]);
});
