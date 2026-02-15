import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { ipc, type ChatStreamEvent, type GatewayStatus } from "@/lib/ipc";

// ── Types ────────────────────────────────────────────────────────

export interface RescueMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

interface RescueState {
  gatewayStatus: GatewayStatus;
  wsConnected: boolean;
  messages: RescueMessage[];
  input: string;
  isOpen: boolean;
  sessionId: string;
}

interface RescueActions {
  startGateway: () => Promise<void>;
  stopGateway: () => Promise<void>;
  connect: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  handleStreamEvent: (event: ChatStreamEvent) => void;
  setGatewayStatus: (status: GatewayStatus) => void;
  setWsConnected: (connected: boolean) => void;
  setInput: (input: string) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

type RescueStore = RescueState & RescueActions;

// ── Initial state ───────────────────────────────────────────────

const initialState: RescueState = {
  gatewayStatus: "stopped",
  wsConnected: false,
  messages: [],
  input: "",
  isOpen: false,
  sessionId: "rescue",
};

// ── Store ───────────────────────────────────────────────────────

export const useRescueStore = create<RescueStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startGateway: async () => {
        set({ gatewayStatus: "starting" }, false, "startGateway");
        try {
          await ipc.rescue.gateway.start();
          const actual = await ipc.rescue.gateway.getStatus();
          set({ gatewayStatus: actual }, false, "startGateway/ok");
        } catch {
          set({ gatewayStatus: "error" }, false, "startGateway/error");
        }
      },

      stopGateway: async () => {
        try {
          await ipc.rescue.gateway.stop();
          set({ gatewayStatus: "stopped" }, false, "stopGateway/ok");
        } catch {
          // best-effort
        }
      },

      connect: async () => {
        try {
          await ipc.rescue.chat.connect();
        } catch {
          // will be surfaced via error event
        }
      },

      sendMessage: async (text: string) => {
        const id = crypto.randomUUID();
        const userMsg: RescueMessage = {
          id,
          role: "user",
          content: text,
          timestamp: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, userMsg], input: "" }), false, "sendMessage/user");
        try {
          await ipc.rescue.chat.send({
            sessionId: get().sessionId,
            message: text,
            messageId: id,
          });
        } catch {
          // error will arrive via stream event
        }
      },

      handleStreamEvent: (event: ChatStreamEvent) => {
        set(
          (s) => {
            const msgs = [...s.messages];
            const lastIdx = msgs.findIndex(
              (m) => m.role === "assistant" && m.id === event.messageId,
            );

            if (event.type === "delta") {
              if (lastIdx >= 0) {
                const prev = msgs[lastIdx];
                msgs[lastIdx] = { ...prev, content: prev.content + (event.content ?? "") };
              } else {
                msgs.push({
                  id: event.messageId,
                  role: "assistant",
                  content: event.content ?? "",
                  timestamp: Date.now(),
                  isStreaming: true,
                });
              }
            } else if (event.type === "end" && lastIdx >= 0) {
              msgs[lastIdx] = { ...msgs[lastIdx], isStreaming: false };
            } else if (event.type === "error" && lastIdx >= 0) {
              msgs[lastIdx] = {
                ...msgs[lastIdx],
                isStreaming: false,
                content: msgs[lastIdx].content + `\n[error: ${event.error ?? "unknown"}]`,
              };
            }

            return { messages: msgs };
          },
          false,
          `handleStreamEvent/${event.type}`,
        );
      },

      setGatewayStatus: (status) => set({ gatewayStatus: status }, false, "setGatewayStatus"),
      setWsConnected: (connected) => set({ wsConnected: connected }, false, "setWsConnected"),
      setInput: (input) => set({ input }, false, "setInput"),
      open: () => set({ isOpen: true }, false, "open"),
      close: () => set({ isOpen: false }, false, "close"),
      toggle: () => set((s) => ({ isOpen: !s.isOpen }), false, "toggle"),
    }),
    { name: "RescueStore" },
  ),
);

// ── Selectors ───────────────────────────────────────────────────

export const selectRescueGatewayStatus = (s: RescueStore) => s.gatewayStatus;
export const selectRescueMessages = (s: RescueStore) => s.messages;
export const selectIsRescueOpen = (s: RescueStore) => s.isOpen;
export const selectRescueInput = (s: RescueStore) => s.input;

// ── IPC listener bootstrap ──────────────────────────────────────

let listenerInitialized = false;

export function initRescueListener(): void {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  const store = useRescueStore.getState();

  ipc.rescue.gateway.onStatusChange((status) => {
    useRescueStore.getState().setGatewayStatus(status);
  });

  ipc.rescue.chat.onStream((event) => {
    useRescueStore.getState().handleStreamEvent(event);
  });

  ipc.rescue.chat.onConnected(() => {
    useRescueStore.getState().setWsConnected(true);
  });

  ipc.rescue.chat.onDisconnected(() => {
    useRescueStore.getState().setWsConnected(false);
  });

  // Fetch initial status
  ipc.rescue.gateway.getStatus().then((status) => {
    store.setGatewayStatus(status);
  });
}
