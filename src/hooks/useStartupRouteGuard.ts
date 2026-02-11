import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { StartupState } from "./useAppBootstrapOnce";

export function useStartupRouteGuard(state: StartupState): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (state.isChecking) return;
    if (state.openclawInstalled) return;
    navigate("/onboarding", { replace: true });
  }, [navigate, state.isChecking, state.openclawInstalled]);
}
