import type { OAuthProviderStatus } from "@clawui/types/models";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from "@clawui/ui";
import { Key, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
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

function mapProviderToKey(provider: string): "anthropic" | "openai" | "openrouter" {
  if (provider === "openai-codex") return "openai";
  if (provider === "anthropic") return "anthropic";
  if (provider === "openrouter") return "openrouter";
  return "openai";
}

function findOAuthStatus(
  modelsStatus: { auth: { oauthStatus?: { providers: OAuthProviderStatus[] } } },
  provider: string,
): OAuthProviderStatus | undefined {
  return modelsStatus.auth.oauthStatus?.providers.find((p) => p.provider === provider);
}

export function ApiTab() {
  const { t } = useTranslation("common");

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
      setApiKey(mapProviderToKey(provider), value);
    },
    [setApiKey],
  );

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

  if (modelsStatus) {
    return (
      <div className="space-y-4">
        <ModelConfig defaultModel={modelsStatus.defaultModel} fallbacks={modelsStatus.fallbacks} />
        {modelsStatus.auth.providers.map((p) => (
          <ProviderCard
            key={p.provider}
            provider={p.provider}
            authInfo={p}
            oauthStatus={findOAuthStatus(modelsStatus, p.provider)}
            apiKeyValue={apiKeys[mapProviderToKey(p.provider)]}
            onApiKeyChange={handleApiKeyChange(p.provider)}
            onApiKeySave={saveApiKeys}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
          />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          <CardTitle>{t("settings.page.api.fallback.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.page.api.fallback.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="anthropic-key">
            {t("settings.page.api.fallback.fields.anthropicKey")}
          </Label>
          <Input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            value={apiKeys.anthropic}
            onChange={(e) => setApiKey("anthropic", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openai-key">{t("settings.page.api.fallback.fields.openaiKey")}</Label>
          <Input
            id="openai-key"
            type="password"
            placeholder="sk-..."
            value={apiKeys.openai}
            onChange={(e) => setApiKey("openai", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openrouter-key">
            {t("settings.page.api.fallback.fields.openrouterKey")}
          </Label>
          <Input
            id="openrouter-key"
            type="password"
            placeholder="sk-or-..."
            value={apiKeys.openrouter}
            onChange={(e) => setApiKey("openrouter", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={saveApiKeys} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("status.saving")}
              </>
            ) : (
              t("settings.page.api.fallback.actions.saveApiKeys")
            )}
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              {t("settings.page.api.fallback.saved")}
            </span>
          )}
          {settingsError && (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {settingsError}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
