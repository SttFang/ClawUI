import { IpcMain, BrowserWindow } from "electron";
import { UpdaterService } from "../services/updater";

export function registerAppHandlers(ipcMain: IpcMain, updater: UpdaterService): void {
  ipcMain.handle("app:version", () => {
    return updater.getVersion();
  });

  ipcMain.handle("app:check-updates", async () => {
    return updater.checkForUpdates();
  });

  ipcMain.on("app:quit-and-install", () => {
    updater.quitAndInstall();
  });

  ipcMain.on("app:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.on("app:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.on("app:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });
}
