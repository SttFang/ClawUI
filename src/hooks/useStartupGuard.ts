import { useAppBootstrapOnce, type StartupState } from "./useAppBootstrapOnce";
import { useStartupRouteGuard } from "./useStartupRouteGuard";

export type { StartupState };

export function useStartupGuard(): StartupState {
  const state = useAppBootstrapOnce();
  useStartupRouteGuard(state);
  return state;
}
