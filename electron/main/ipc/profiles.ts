import type { IpcMain } from 'electron'
import type { OpenClawProfilesService, OpenClawProfileId } from '../services/openclaw-profiles'

export function registerProfilesHandlers(ipcMain: IpcMain, profiles: OpenClawProfilesService): void {
  ipcMain.handle('profiles:ensure', async () => {
    await profiles.initialize()
    return {
      paths: {
        main: profiles.getConfigPath('main'),
        configAgent: profiles.getConfigPath('configAgent'),
      },
    }
  })

  ipcMain.handle(
    'profiles:patch-env-both',
    async (_event, patch: Record<string, string | null | undefined>) => {
      await profiles.patchEnvBoth(patch)
    },
  )

  ipcMain.handle('profiles:config-path', async (_event, profileId: OpenClawProfileId): Promise<string> => {
    return profiles.getConfigPath(profileId)
  })
}

