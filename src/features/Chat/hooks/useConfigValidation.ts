import { useCallback, useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";

function hasConfiguredModelAuth(modelsStatus: unknown): boolean {
  if (!modelsStatus || typeof modelsStatus !== "object") return false;

  const auth = (modelsStatus as { auth?: unknown }).auth;
  if (!auth || typeof auth !== "object") return false;

  const providers = (auth as { providers?: unknown[] }).providers;
  if (Array.isArray(providers)) {
    const hasEffectiveProvider = providers.some((p) => {
      if (!p || typeof p !== "object") return false;
      const kind = (p as { effective?: { kind?: unknown } }).effective?.kind;
      return kind === "env" || kind === "profiles" || kind === "token";
    });
    if (hasEffectiveProvider) return true;
  }

  const oauthProviders =
    (auth as { oauth?: { providers?: unknown[] } }).oauth?.providers ??
    (auth as { oauthStatus?: { providers?: unknown[] } }).oauthStatus?.providers;
  if (Array.isArray(oauthProviders)) {
    return oauthProviders.some((p) => {
      if (!p || typeof p !== "object") return false;
      return (p as { status?: unknown }).status === "ok";
    });
  }

  return false;
}

export function useConfigValidation() {
  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      try {
        const [runtimeStatus, modelsStatus] = await Promise.all([
          ipc.onboarding.detect(),
          ipc.models.status(),
        ]);
        const validFromRuntime = runtimeStatus?.configValid ?? false;
        const validFromModels = hasConfiguredModelAuth(modelsStatus);
        setConfigValid(validFromRuntime || validFromModels);
      } catch {
        setConfigValid(false);
      }
    }
    void checkConfig();
  }, []);

  const onDismissBanner = useCallback(() => setShowBanner(false), []);

  return { configValid, showBanner, onDismissBanner } as const;
}
