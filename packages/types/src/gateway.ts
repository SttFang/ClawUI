// ============================================
// Gateway Types
// ============================================

/**
 * Gateway process status
 */
export type GatewayStatus = "stopped" | "starting" | "running" | "error";

/**
 * Gateway state for store
 */
export interface GatewayState {
  status: GatewayStatus;
  port: number;
  error?: string;
}

/**
 * Gateway event frame (WebSocket server → client).
 *
 * Note: This is the top-level frame shape used by OpenClaw's ACP protocol.
 * In ClawUI we forward only `type="event"` frames to the renderer.
 */
export interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}
