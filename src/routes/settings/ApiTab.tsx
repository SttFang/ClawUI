import type { OAuthProviderStatus, ProviderAuthInfo } from "@clawui/types/models";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@clawui/ui";
import { Key, Loader2, AlertCircle } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModelConfig } from "@/components/Settings/ModelConfig";
import { ProviderCard } from "@/components/Settings/ProviderCard";
import {
  useSettingsStore,
  selectApiKeys,
  selectIsSaving,
  selectSaveSuccess,
  selectError,
  selectModelsStatus,
  selectModelsLoading,
} from "@/store/settings";
import { canSaveApiKeyForProvider } from "@/store/settings/providerConfigMiddleware";
import {
  getApiKeyInputValue,
  getFallbackProviderIds,
  normalizeProviderId,
} from "@/store/settings/providerRegistry";

const fallbackProviderInfos: ProviderAuthInfo[] = getFallbackProviderIds().map((provider) => ({
  provider,
  effective: { kind: "none" },
}));

function findOAuthStatus(
  modelsStatus: { auth: Record<string, unknown> },
  provider: string,
): OAuthProviderStatus | undefined {
  const auth = modelsStatus.auth as {
    oauth?: { providers?: OAuthProviderStatus[] };
    oauthStatus?: { providers?: OAuthProviderStatus[] };
  };
  const list = auth.oauth?.providers ?? auth.oauthStatus?.providers ?? [];
  return list.find((p) => p.provider === provider);
}

export function ApiTab() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const apiKeys = useSettingsStore(selectApiKeys);
  const isSaving = useSettingsStore(selectIsSaving);
  const saveSuccess = useSettingsStore(selectSaveSuccess);
  const settingsError = useSettingsStore(selectError);
  const modelsStatus = useSettingsStore(selectModelsStatus);
  const modelsLoading = useSettingsStore(selectModelsLoading);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const saveApiKeys = useSettingsStore((s) => s.saveApiKeys);

  const handleApiKeyChange = useCallback(
    (provider: string) => (value: string) => {
      setApiKey(provider, value);
    },
    [setApiKey],
  );
  const providerInfos = useMemo(() => {
    const merged: ProviderAuthInfo[] = [];
    const seen = new Set<string>();

    for (const provider of modelsStatus?.auth.providers ?? []) {
      const providerId = normalizeProviderId(provider.provider);
      if (!providerId || seen.has(providerId)) continue;
      merged.push({ ...provider, provider: providerId });
      seen.add(providerId);
    }

    for (const provider of fallbackProviderInfos) {
      const providerId = normalizeProviderId(provider.provider);
      if (!providerId || seen.has(providerId)) continue;
      merged.push({ ...provider, provider: providerId });
      seen.add(providerId);
    }

    return merged;
  }, [modelsStatus]);

  if (modelsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">{t("settings.page.api.loading")}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {modelsStatus ? (
        <ModelConfig defaultModel={modelsStatus.defaultModel} fallbacks={modelsStatus.fallbacks} />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              <CardTitle>{t("settings.page.api.fallback.title")}</CardTitle>
            </div>
            <CardDescription>{t("settings.page.api.fallback.description")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("settings.page.api.fallback.statusUnavailable")}
          </CardContent>
        </Card>
      )}

      {settingsError && (
        <Card>
          <CardContent className="pt-4">
            <span className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {settingsError}
            </span>
          </CardContent>
        </Card>
      )}

      {providerInfos.map((provider) => (
        <ProviderCard
          key={provider.provider}
          provider={provider.provider}
          authInfo={provider}
          oauthStatus={modelsStatus ? findOAuthStatus(modelsStatus, provider.provider) : undefined}
          apiKeyValue={getApiKeyInputValue(apiKeys, provider.provider)}
          onApiKeyChange={handleApiKeyChange(provider.provider)}
          onApiKeySave={() => void saveApiKeys(provider.provider)}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          canSaveApiKey={canSaveApiKeyForProvider({
            providerId: provider.provider,
            modelsStatus,
          })}
          onOAuthAction={() => navigate("/settings?tab=models")}
        />
      ))}
    </div>
  );
}
