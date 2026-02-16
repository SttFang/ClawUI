import { ipc } from "@/lib/ipc";
import { useCompactionStore } from "@/store/compaction";
import { useRunMapStore } from "./store";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

let runMapListenerInitialized = false;

export function initRunMapListener() {
  if (runMapListenerInitialized || typeof window === "undefined") return;
  runMapListenerInitialized = true;

  ipc.chat.onNormalizedEvent((event) => {
    useRunMapStore.getState().ingestNormalizedEvent(event);

    if (event.rawEventName === "agent.compaction" && event.sessionKey) {
      const meta = isRecord(event.metadata) ? event.metadata : null;
      const phase = typeof meta?.phase === "string" ? meta.phase : "";
      const willRetry = meta?.willRetry === true;
      const compacting = phase === "start" || (phase === "end" && willRetry);
      useCompactionStore.getState().setCompacting(event.sessionKey, compacting);
    }
  });

  ipc.gateway.onEvent((frame) => {
    useRunMapStore.getState().ingestGatewayFrame(frame);
  });
}
