import type { ElectronAPI } from '@/lib/ipc'

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}
