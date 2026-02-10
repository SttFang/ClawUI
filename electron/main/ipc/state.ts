import { BrowserWindow, dialog } from "electron";
import type { IpcMain } from "electron";
import type { OpenDialogOptions, SaveDialogOptions } from "electron";
import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import type { ClawUIState, ClawUIStateService, DeepPartial } from "../services/clawui-state";

export function registerStateHandlers(ipcMain: IpcMain, stateService: ClawUIStateService): void {
  ipcMain.handle("state:get", async (): Promise<ClawUIState> => {
    return stateService.get();
  });

  ipcMain.handle(
    "state:patch",
    async (_event, partial: DeepPartial<ClawUIState>): Promise<ClawUIState> => {
      // Renderer never gets to patch secrets here; this is for ClawUI's own state only.
      return stateService.patch(partial);
    },
  );

  ipcMain.handle("state:path", (): string => {
    return stateService.getPath();
  });

  ipcMain.handle("state:export", async (): Promise<{ path: string | null }> => {
    const win = BrowserWindow.getFocusedWindow();
    const opts: SaveDialogOptions = {
      title: "Export ClawUI State",
      defaultPath: basename(stateService.getPath()),
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { path: null };

    const state = await stateService.get();
    await writeFile(res.filePath, JSON.stringify(state, null, 2), "utf-8");
    return { path: res.filePath };
  });

  ipcMain.handle("state:import", async (): Promise<{ path: string | null; state: ClawUIState }> => {
    const win = BrowserWindow.getFocusedWindow();
    const opts: OpenDialogOptions = {
      title: "Import ClawUI State",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (res.canceled || !res.filePaths[0]) {
      return { path: null, state: await stateService.get() };
    }

    const filePath = res.filePaths[0];
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ClawUIState>;
    const next = await stateService.replace(parsed as any);
    return { path: filePath, state: next };
  });
}
