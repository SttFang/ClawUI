import type { IpcMain } from 'electron'
import type { ClawUIState, ClawUIStateService } from '../services/clawui-state'

export function registerStateHandlers(ipcMain: IpcMain, stateService: ClawUIStateService): void {
  ipcMain.handle('state:get', async (): Promise<ClawUIState> => {
    return stateService.get()
  })

  ipcMain.handle('state:patch', async (_event, partial: Partial<ClawUIState>): Promise<ClawUIState> => {
    // Renderer never gets to patch secrets here; this is for ClawUI's own state only.
    return stateService.patch(partial)
  })

  ipcMain.handle('state:path', (): string => {
    return stateService.getPath()
  })
}

