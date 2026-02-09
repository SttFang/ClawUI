import { create } from 'zustand'
import { ipc, GatewayStatus } from '@/lib/ipc'

interface GatewayState {
  status: GatewayStatus
  port: number
  error: string | null
  websocketUrl: string
}

interface GatewayActions {
  start: () => Promise<void>
  stop: () => Promise<void>
  setStatus: (status: GatewayStatus) => void
  setError: (error: string | null) => void
}

type GatewayStore = GatewayState & GatewayActions

const initialState: GatewayState = {
  status: 'stopped',
  port: 18789,
  error: null,
  websocketUrl: 'ws://localhost:18789',
}

export const useGatewayStore = create<GatewayStore>((set) => ({
  ...initialState,

  start: async () => {
    set({ status: 'starting', error: null })
    try {
      await ipc.gateway.start()
      // Sync actual status from main process in case the IPC event was missed
      const actual = await ipc.gateway.getStatus()
      set({ status: actual })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start gateway'
      set({ status: 'error', error: message })
    }
  },

  stop: async () => {
    try {
      await ipc.gateway.stop()
      set({ status: 'stopped' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop gateway'
      set({ error: message })
    }
  },

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
}))

// Selectors
export const selectGatewayStatus = (state: GatewayStore) => state.status
export const selectGatewayError = (state: GatewayStore) => state.error
export const selectWebsocketUrl = (state: GatewayStore) => state.websocketUrl
export const selectIsGatewayRunning = (state: GatewayStore) => state.status === 'running'

// Initialize IPC listener lazily to avoid issues during SSR/initial load
let ipcListenerInitialized = false
export function initGatewayIpcListener() {
  if (ipcListenerInitialized || typeof window === 'undefined') return
  ipcListenerInitialized = true

  ipc.gateway.onStatusChange((status) => {
    useGatewayStore.getState().setStatus(status)
  })
}
