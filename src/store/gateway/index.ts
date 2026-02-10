import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, GatewayStatus } from "@/lib/ipc";

interface GatewayState {
  status: GatewayStatus;
  port: number;
  error: string | null;
  websocketUrl: string;
}

interface GatewayActions {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setStatus: (status: GatewayStatus) => void;
  setError: (error: string | null) => void;
}

type GatewayStore = GatewayState & GatewayActions;

const initialState: GatewayState = {
  status: "stopped",
  port: 18789,
  error: null,
  websocketUrl: "ws://localhost:18789",
};

export const useGatewayStore = create<GatewayStore>()(
  devtools(
    (set) => ({
      ...initialState,

      start: async () => {
        set({ status: "starting", error: null }, false, "start");
        try {
          await ipc.gateway.start();
          const actual = await ipc.gateway.getStatus();
          set({ status: actual }, false, "start/success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to start gateway";
          set({ status: "error", error: message }, false, "start/error");
        }
      },

      stop: async () => {
        try {
          await ipc.gateway.stop();
          set({ status: "stopped" }, false, "stop/success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to stop gateway";
          set({ error: message }, false, "stop/error");
        }
      },

      setStatus: (status) => set({ status }, false, "setStatus"),
      setError: (error) => set({ error }, false, "setError"),
    }),
    { name: "GatewayStore" },
  ),
);

// Selectors
export const selectGatewayStatus = (state: GatewayStore) => state.status;
export const selectGatewayError = (state: GatewayStore) => state.error;
export const selectWebsocketUrl = (state: GatewayStore) => state.websocketUrl;
export const selectIsGatewayRunning = (state: GatewayStore) => state.status === "running";

// Initialize IPC listener lazily to avoid issues during SSR/initial load
let ipcListenerInitialized = false;
export function initGatewayIpcListener() {
  if (ipcListenerInitialized || typeof window === "undefined") return;
  ipcListenerInitialized = true;

  ipc.gateway.onStatusChange((status) => {
    useGatewayStore.getState().setStatus(status);
  });
}
