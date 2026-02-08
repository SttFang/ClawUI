import { contextBridge, ipcRenderer } from 'electron'

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  gateway: {
    start: () => ipcRenderer.invoke('gateway:start'),
    stop: () => ipcRenderer.invoke('gateway:stop'),
    getStatus: () => ipcRenderer.invoke('gateway:status'),
    onStatusChange: (callback: (status: GatewayStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: GatewayStatus) => callback(status)
      ipcRenderer.on('gateway:status-changed', listener)
      return () => {
        ipcRenderer.removeListener('gateway:status-changed', listener)
      }
    },
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: unknown) => ipcRenderer.invoke('config:set', config),
    getPath: () => ipcRenderer.invoke('config:path'),
  },
  subscription: {
    login: (credentials: { email: string; password: string }) =>
      ipcRenderer.invoke('subscription:login', credentials),
    logout: () => ipcRenderer.invoke('subscription:logout'),
    getStatus: () => ipcRenderer.invoke('subscription:status'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
    quitAndInstall: () => ipcRenderer.send('app:quit-and-install'),
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    close: () => ipcRenderer.send('app:close'),
  },
})
