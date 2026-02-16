import type { BrowserWindow as BrowserWindowType } from "electron";
import { BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { mainLog } from "../lib/logger";
import { buildWindowChromeOptions } from "./chrome-config";

interface CreateMainWindowOptions {
  isDev: boolean;
  rendererUrl?: string;
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindowType {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...buildWindowChromeOptions(process.platform),
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith("https://")) {
      shell.openExternal(details.url);
    } else {
      mainLog.warn("[window.blockedUrl]", details.url);
    }
    return { action: "deny" };
  });

  if (options.isDev && options.rendererUrl) {
    mainWindow.loadURL(options.rendererUrl);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}
