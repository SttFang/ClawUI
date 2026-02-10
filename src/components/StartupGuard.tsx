import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useStartupGuard } from "@/hooks/useStartupGuard";

interface StartupGuardProps {
  children: React.ReactNode;
}

/**
 * StartupGuard checks if OpenClaw is installed on startup.
 * - If NOT installed → redirect to /onboarding for installation
 * - If installed → start Gateway, connect WebSocket, allow access to main app
 *
 * All business logic lives in useStartupGuard().
 */
export function StartupGuard({ children }: StartupGuardProps) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const state = useStartupGuard();

  if (state.isChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("startup.checkingOpenClaw")}</p>
        </div>
      </div>
    );
  }

  if (!state.openclawInstalled && location.pathname !== "/onboarding") {
    return null;
  }

  return <>{children}</>;
}
