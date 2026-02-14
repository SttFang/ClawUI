import { ipc } from "@/lib/ipc";
import { useRunMapStore } from "./store";

let runMapListenerInitialized = false;

export function initRunMapListener() {
  if (runMapListenerInitialized || typeof window === "undefined") return;
  runMapListenerInitialized = true;

  ipc.chat.onNormalizedEvent((event) => {
    useRunMapStore.getState().ingestNormalizedEvent(event);
  });

  ipc.gateway.onEvent((frame) => {
    useRunMapStore.getState().ingestGatewayFrame(frame);
  });
}
