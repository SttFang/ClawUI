import type { ChatNormalizedRunEvent, GatewayEventFrame } from "@/lib/ipc";

export type RunMapState = {
  sessions: Record<string, import("@clawui/types/run-map").SessionRunMap>;
};

export type RunMapActions = {
  ingestNormalizedEvent: (event: ChatNormalizedRunEvent) => void;
  ingestGatewayFrame: (frame: GatewayEventFrame) => void;
  clearSession: (sessionKey: string) => void;
  resetAll: () => void;
};

export type RunMapStore = RunMapState & RunMapActions;
