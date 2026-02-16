import { ipcRenderer } from "electron";

/**
 * Create a typed event listener that returns an unsubscribe function.
 */
export function createEventListener<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: T) => callback(...args);
  ipcRenderer.on(channel, listener as (...args: unknown[]) => void);
  return () => ipcRenderer.removeListener(channel, listener as (...args: unknown[]) => void);
}

/**
 * Shorthand for no-arg event listeners (e.g. "chat:connected").
 */
export function createVoidListener(channel: string, callback: () => void): () => void {
  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
