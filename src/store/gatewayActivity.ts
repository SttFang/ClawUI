import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { TRACKED_GATEWAY_EVENTS } from "@clawui/constants";
import type { GatewayEventFrame } from "@/lib/ipc";
import { ipc } from "@/lib/ipc";

export interface GatewayActivityEntry {
  id: number;
  event: string;
  ts: number;
  payload?: unknown;
  label: string;
}

interface GatewayActivityState {
  entries: GatewayActivityEntry[];
  lastTickAt: number | null;
  tickIntervalMs: number;
  tickCount: number;
}

interface GatewayActivityActions {
  onTick: (payload: unknown) => void;
  pushEntry: (frame: GatewayEventFrame) => void;
  reset: () => void;
}

type GatewayActivityStore = GatewayActivityState & GatewayActivityActions;

const MAX_ENTRIES = 50;
let nextId = 1;

const initialState: GatewayActivityState = {
  entries: [],
  lastTickAt: null,
  tickIntervalMs: 30_000,
  tickCount: 0,
};

function buildLabel(event: string, payload: unknown): string {
  const p = payload as Record<string, unknown> | undefined;
  switch (event) {
    case "heartbeat":
      return `reason: ${typeof p?.reason === "string" ? p.reason : "unknown"}`;
    case "health":
      return "gateway healthy";
    case "shutdown":
      return typeof p?.reason === "string" ? p.reason : "shutdown";
    case "exec.approval.requested": {
      const req = p?.request as Record<string, unknown> | undefined;
      return typeof req?.command === "string" ? req.command : "exec approval";
    }
    case "exec.approval.resolved": {
      const decision = typeof p?.decision === "string" ? p.decision : "?";
      const cmd = typeof p?.command === "string" ? p.command : "";
      return cmd ? `${decision} · ${cmd}` : decision;
    }
    case "cron": {
      const action = typeof p?.action === "string" ? p.action : "";
      const status = typeof p?.status === "string" ? p.status : "";
      const summary = typeof p?.summary === "string" ? p.summary : "";
      const error = typeof p?.error === "string" ? p.error : "";
      const durationMs = typeof p?.durationMs === "number" ? p.durationMs : undefined;
      const parts = [action];
      if (status) parts.push(status);
      if (summary) parts.push(summary);
      else if (error) parts.push(error);
      if (durationMs !== undefined) parts.push(`${(durationMs / 1000).toFixed(1)}s`);
      return parts.join(" · ");
    }
    default:
      return event;
  }
}

export const useGatewayActivityStore = create<GatewayActivityStore>()(
  devtools(
    (set) => ({
      ...initialState,

      onTick: (payload) =>
        set(
          (state) => {
            const p = payload as Record<string, unknown> | undefined;
            const intervalMs =
              typeof p?.tickIntervalMs === "number" ? p.tickIntervalMs : state.tickIntervalMs;
            return {
              lastTickAt: Date.now(),
              tickCount: state.tickCount + 1,
              tickIntervalMs: intervalMs,
            };
          },
          false,
          "gatewayActivity/onTick",
        ),

      pushEntry: (frame) =>
        set(
          (state) => {
            const entry: GatewayActivityEntry = {
              id: nextId++,
              event: frame.event,
              ts: Date.now(),
              payload: frame.payload,
              label: buildLabel(frame.event, frame.payload),
            };
            const next = [...state.entries, entry];
            if (next.length > MAX_ENTRIES) next.shift();
            return { entries: next };
          },
          false,
          "gatewayActivity/pushEntry",
        ),

      reset: () => set({ ...initialState, entries: [] }, false, "gatewayActivity/reset"),
    }),
    { name: "GatewayActivityStore" },
  ),
);

// Selectors
export const selectLastTickAt = (s: GatewayActivityStore) => s.lastTickAt;
export const selectTickIntervalMs = (s: GatewayActivityStore) => s.tickIntervalMs;
export const selectTickCount = (s: GatewayActivityStore) => s.tickCount;
export const selectActivityEntries = (s: GatewayActivityStore) => s.entries;
export const selectCronEntries = (s: GatewayActivityStore) =>
  s.entries.filter((e) => e.event === "cron");

// Listener initialization
let listenerInitialized = false;

export function initGatewayActivityListener(): void {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  ipc.gateway.onEvent((frame: GatewayEventFrame) => {
    if (!frame || frame.type !== "event") return;

    if (frame.event === "tick") {
      useGatewayActivityStore.getState().onTick(frame.payload);
      return;
    }

    if (TRACKED_GATEWAY_EVENTS.has(frame.event)) {
      useGatewayActivityStore.getState().pushEntry(frame);
    }
  });
}
