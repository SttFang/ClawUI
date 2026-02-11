import { useEffect, useRef, useState } from "react";
import { ipc, RuntimeStatus } from "@/lib/ipc";
import { startupLog } from "@/lib/logger";
import { useChatStore } from "@/store/chat";
import { useGatewayStore, selectGatewayStatus } from "@/store/gateway";
import { useUIStore } from "@/store/ui";

export interface StartupState {
  isChecking: boolean;
  openclawInstalled: boolean;
  configValid: boolean;
  runtimeStatus: RuntimeStatus | null;
}

export function useAppBootstrapOnce(): StartupState {
  const [state, setState] = useState<StartupState>({
    isChecking: true,
    openclawInstalled: false,
    configValid: false,
    runtimeStatus: null,
  });

  const wsConnectionAttempted = useRef(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    async function bootstrap() {
      try {
        let clawuiState: Awaited<ReturnType<typeof ipc.state.get>> | null = null;
        try {
          clawuiState = await ipc.state.get();
          useUIStore.getState().hydrate(clawuiState.ui);
        } catch {
          // Best-effort: startup should continue even if state is unreadable.
        }

        startupLog.info("Starting OpenClaw detection...");
        const status = await ipc.onboarding.detect();
        startupLog.info("Detection result:", status);

        if (!status) {
          setState({
            isChecking: false,
            openclawInstalled: false,
            configValid: false,
            runtimeStatus: null,
          });
          return;
        }

        setState({
          isChecking: false,
          openclawInstalled: status.openclawInstalled,
          configValid: status.configValid,
          runtimeStatus: status,
        });

        if (status.openclawInstalled) {
          startupLog.info("OpenClaw installed, starting Gateway");
          const gatewayStore = useGatewayStore.getState();
          const shouldAutoStart = clawuiState?.openclaw?.autoStart?.main !== false;
          if (shouldAutoStart && gatewayStore.status === "stopped") {
            gatewayStore.start();
          }
        }
      } catch (error) {
        startupLog.error("Failed to check OpenClaw:", error);
        setState((prev) => ({ ...prev, isChecking: false, openclawInstalled: false }));
      }
    }

    void bootstrap();
  }, []);

  const gatewayStatus = useGatewayStore(selectGatewayStatus);

  useEffect(() => {
    if (gatewayStatus === "running" && state.openclawInstalled && !wsConnectionAttempted.current) {
      wsConnectionAttempted.current = true;
      const timer = setTimeout(() => {
        startupLog.info("Gateway running, connecting WebSocket...");
        useChatStore.getState().connectWebSocket();
      }, 500);
      return () => clearTimeout(timer);
    }

    if (gatewayStatus === "stopped") {
      wsConnectionAttempted.current = false;
    }
  }, [gatewayStatus, state.openclawInstalled]);

  return state;
}
