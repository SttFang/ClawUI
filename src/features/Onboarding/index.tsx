import { Button, Progress } from "@clawui/ui";
import { Loader2, Download, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useOnboardingStore,
  selectOnboardingStep,
  selectRuntimeStatus,
  selectInstallProgress,
  selectError,
} from "@/store/onboarding";

// Draggable title bar for frameless window
function DraggableTitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-11 z-50"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    />
  );
}

const stageLabelKeys: Record<string, string> = {
  idle: "onboarding.stages.idle",
  "checking-requirements": "onboarding.stages.checkingRequirements",
  "installing-openclaw": "onboarding.stages.installingOpenclaw",
  verifying: "onboarding.stages.verifying",
  complete: "onboarding.stages.complete",
  error: "onboarding.stages.error",
};

export function Onboarding() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const step = useOnboardingStore(selectOnboardingStep);
  const runtimeStatus = useOnboardingStore(selectRuntimeStatus);
  const installProgress = useOnboardingStore(selectInstallProgress);
  const error = useOnboardingStore(selectError);

  const detectRuntime = useOnboardingStore((s) => s.detectRuntime);
  const startInstall = useOnboardingStore((s) => s.startInstall);
  const reset = useOnboardingStore((s) => s.reset);

  // Auto-detect runtime on mount
  useEffect(() => {
    detectRuntime();
  }, [detectRuntime]);

  // Navigate to chat when complete
  useEffect(() => {
    if (step === "complete") {
      // Small delay for user to see completion
      const timer = setTimeout(() => {
        navigate("/", { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  const handleInstall = () => {
    startInstall();
  };

  const handleRetry = () => {
    reset();
    detectRuntime();
  };

  const errorText = (() => {
    if (!error) return t("onboarding.errors.unexpected");
    return error.startsWith("onboarding.") ? t(error) : error;
  })();

  return (
    <>
      <DraggableTitleBar />
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo/Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">ClawUI</h1>
            <p className="text-muted-foreground">{t("onboarding.subtitle")}</p>
          </div>

          {/* Step Content */}
          <div className="space-y-6">
            {step === "checking" && (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">{t("onboarding.checking")}</p>
              </div>
            )}

            {step === "install" && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <Download className="h-12 w-12 mx-auto text-primary" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t("onboarding.install.title")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("onboarding.install.description")}
                    </p>
                  </div>
                  {runtimeStatus && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        {t("onboarding.requirements.node")}:{" "}
                        {runtimeStatus.nodeInstalled
                          ? `✓ ${runtimeStatus.nodeVersion}`
                          : `✗ ${t("onboarding.requirements.notFound")}`}
                      </p>
                      <p>
                        {t("onboarding.requirements.openclaw")}:{" "}
                        {runtimeStatus.openclawInstalled
                          ? `✓ ${runtimeStatus.openclawVersion}`
                          : `✗ ${t("onboarding.requirements.notFound")}`}
                      </p>
                    </div>
                  )}
                </div>
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  {t("onboarding.install.actions.oneClickInstall")}
                </Button>
              </div>
            )}

            {step === "installing" && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t("onboarding.installing.title")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {installProgress
                        ? t(stageLabelKeys[installProgress.stage] ?? "onboarding.stages.idle")
                        : t("onboarding.installing.starting")}
                    </p>
                  </div>
                  {installProgress && (
                    <div className="space-y-2">
                      <Progress value={installProgress.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {t("onboarding.installing.percentComplete", {
                          percent: installProgress.progress,
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === "complete" && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t("onboarding.complete.title")}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t("onboarding.complete.description")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === "error" && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{t("onboarding.error.title")}</h2>
                    <p className="text-sm text-destructive">{errorText}</p>
                  </div>
                </div>
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("onboarding.error.actions.retry")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Onboarding;
