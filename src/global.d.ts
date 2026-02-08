import type { ElectronAPI } from '@/lib/ipc'

declare global {
  interface Window {
    electron?: ElectronAPI
  }
}
