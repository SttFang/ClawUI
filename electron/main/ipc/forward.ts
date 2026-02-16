import { BrowserWindow } from "electron";
import type { EventEmitter } from "node:events";

/**
 * Send to a specific window, guarding against destroyed windows.
 */
export function sendToWindow(win: BrowserWindow, channel: string, ...args: unknown[]): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

/**
 * Broadcast to all open windows, guarding against destroyed windows.
 */
export function broadcastToWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

/**
 * Wire an EventEmitter's events to a BrowserWindow using a mapping.
 * Returns cleanup function that removes all listeners.
 */
export function forwardToWindow(
  emitter: EventEmitter,
  win: BrowserWindow,
  mapping: Record<string, string>,
): () => void {
  const cleanups: Array<() => void> = [];
  for (const [emitterEvent, ipcChannel] of Object.entries(mapping)) {
    const handler = (...args: unknown[]) => sendToWindow(win, ipcChannel, ...args);
    emitter.on(emitterEvent, handler);
    cleanups.push(() => emitter.removeListener(emitterEvent, handler));
  }
  return () => cleanups.forEach((fn) => fn());
}

/**
 * Wire an EventEmitter's events to ALL windows using a mapping.
 */
export function forwardToAll(
  emitter: EventEmitter,
  mapping: Record<string, string>,
): () => void {
  const cleanups: Array<() => void> = [];
  for (const [emitterEvent, ipcChannel] of Object.entries(mapping)) {
    const handler = (...args: unknown[]) => broadcastToWindows(ipcChannel, ...args);
    emitter.on(emitterEvent, handler);
    cleanups.push(() => emitter.removeListener(emitterEvent, handler));
  }
  return () => cleanups.forEach((fn) => fn());
}
