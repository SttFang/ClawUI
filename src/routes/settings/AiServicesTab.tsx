import type { OAuthProviderStatus, ProviderAuthInfo } from "@clawui/types/models";
import type { ChangeEvent } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
} from "@clawui/ui";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ModelConfig } from "@/features/Settings/components/ModelConfig";
import { ProviderCard } from "@/features/Settings/components/ProviderCard";
import {
  useSecretsStore,
  selectSecretsLoading,
  selectSecretsSaving,
  selectSecretsSaveSuccess,
} from "@/store/secrets";
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
import { useModelConfig, useAuthOrderForm, parseCommaList } from "./hooks";

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

// Tool definitions — matches TOOL_CREDENTIAL_DEFS in tool-credential-registry
const TOOL_DEFS = [
  { toolId: "web_search_brave", label: "Brave Search", placeholder: "BSA..." },
  { toolId: "web_search_perplexity", label: "Perplexity", placeholder: "pplx-..." },
  { toolId: "web_search_grok", label: "Grok (xAI)", placeholder: "xai-..." },
  { toolId: "web_fetch_firecrawl", label: "Firecrawl", placeholder: "fc-..." },
] as const;

export function AiServicesTab() {
  const { t } = useTranslation("common");

  // --- Provider / API Key state ---
  const apiKeys = useSettingsStore(selectApiKeys);
  const isSaving = useSettingsStore(selectIsSaving);
  const saveSuccess = useSettingsStore(selectSaveSuccess);
  const settingsError = useSettingsStore(selectError);
  const modelsStatus = useSettingsStore(selectModelsStatus);
  const modelsLoading = useSettingsStore(selectModelsLoading);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const saveApiKeys = useSettingsStore((s) => s.saveApiKeys);

  // --- Tool API Key state ---
  const toolValues = useSecretsStore((s) => s.toolValues);
  const setToolValue = useSecretsStore((s) => s.setToolValue);
  const secretsLoading = useSecretsStore(selectSecretsLoading);
  const secretsSaving = useSecretsStore(selectSecretsSaving);
  const secretsSaveSuccess = useSecretsStore(selectSecretsSaveSuccess);
  const saveSecrets = useSecretsStore((s) => s.save);

  // --- Model config ---
  const config = useModelConfig();
  const form = useAuthOrderForm(config);

  const handleApiKeyChange = useCallback(
    (provider: string) => (value: string) => {
      setApiKey(provider, value);
    },
    [setApiKey],
  );

  // Merge real providers + fallback list (full coverage)
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

      {/* Model Config: default + fallbacks */}
      {modelsStatus && (
        <ModelConfig
          defaultModel={modelsStatus.defaultModel}
          fallbacks={modelsStatus.fallbacks}
          catalog={config.catalog}
          isLoading={config.isLoading}
          onSetDefault={(model) => void config.setDefaultModel(model)}
          onAddFallback={(model) => void config.addFallback(model)}
          onRemoveFallback={(model) => void config.removeFallback(model)}
        />
      )}

      {/* Provider auth list (default open) */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium">{t("settings.modelConfig.title")}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-b-lg border border-t-0">
            {providerInfos.map((provider) => (
              <ProviderCard
                key={provider.provider}
                provider={provider.provider}
                authInfo={provider}
                oauthStatus={
                  modelsStatus ? findOAuthStatus(modelsStatus, provider.provider) : undefined
                }
                apiKeyValue={getApiKeyInputValue(apiKeys, provider.provider)}
                onApiKeyChange={handleApiKeyChange(provider.provider)}
                onApiKeySave={() => void saveApiKeys(provider.provider)}
                isSaving={isSaving}
                saveSuccess={saveSuccess}
                canSaveApiKey={canSaveApiKeyForProvider({
                  providerId: provider.provider,
                  modelsStatus,
                })}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tool API Keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("settings.page.tokens.toolSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {TOOL_DEFS.map((tool) => (
              <div key={tool.toolId} className="space-y-1">
                <Label htmlFor={tool.toolId}>{tool.label}</Label>
                <Input
                  id={tool.toolId}
                  type="password"
                  value={toolValues[tool.toolId] ?? ""}
                  onChange={(e) => setToolValue(tool.toolId, e.target.value)}
                  placeholder={tool.placeholder}
                  disabled={secretsLoading}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={saveSecrets} disabled={secretsSaving || secretsLoading} size="sm">
              {secretsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("actions.save")}
            </Button>
            {secretsSaveSuccess ? (
              <span className="text-sm text-green-600">{t("settings.page.tokens.saved")}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Advanced: auth order, probe, oauth */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4" />
            {t("settings.page.ai.advanced")}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <AdvancedModelConfig config={config} form={form} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// --- Advanced model configuration (collapsed by default) ---
function AdvancedModelConfig({
  config,
  form,
}: {
  config: ReturnType<typeof useModelConfig>;
  form: ReturnType<typeof useAuthOrderForm>;
}) {
  const { t } = useTranslation("common");
  const {
    selectedProvider,
    error,
    success,
    isLoading,
    lastProbeAt,
    clearMessages,
    loadStatus,
    setSelectedProvider,
    saveAuthOrder,
    clearAuthOrder,
    loadAuthOrder,
    runAuthLogin,
  } = config;

  const {
    authOrderInput,
    setAuthOrderInput,
    authMethodInput,
    setAuthMethodInput,
    providerOptions,
    authOrderDisplay,
  } = form;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {/* Auth Order */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.models.authOrder.title")}</CardTitle>
          <CardDescription>{t("settings.page.models.authOrder.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>{t("settings.page.models.authOrder.provider")}</Label>
            <Select
              value={selectedProvider}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                clearMessages();
                setSelectedProvider(event.target.value);
              }}
              disabled={isLoading || providerOptions.length === 0}
            >
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.page.models.authOrder.orderInput")}</Label>
            <Input
              value={authOrderInput}
              onChange={(event) => setAuthOrderInput(event.target.value)}
              placeholder={t("settings.page.models.authOrder.orderPlaceholder")}
              disabled={isLoading || !selectedProvider}
            />
            <div className="text-xs text-muted-foreground">
              {t("settings.page.models.authOrder.current", {
                value: authOrderDisplay || t("settings.page.models.authOrder.inherit"),
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                clearMessages();
                void saveAuthOrder(parseCommaList(authOrderInput), selectedProvider);
              }}
              disabled={isLoading || !selectedProvider}
            >
              {t("settings.page.models.authOrder.save")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearMessages();
                void clearAuthOrder(selectedProvider);
              }}
              disabled={isLoading || !selectedProvider}
            >
              {t("settings.page.models.authOrder.clear")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearMessages();
                void loadAuthOrder(selectedProvider);
              }}
              disabled={isLoading || !selectedProvider}
            >
              {t("settings.page.models.authOrder.refresh")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auth Probe */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.models.probe.title")}</CardTitle>
          <CardDescription>{t("settings.page.models.probe.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                clearMessages();
                void loadStatus({ probe: true });
              }}
              disabled={isLoading}
            >
              {t("settings.page.models.probe.runAll")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearMessages();
                void loadStatus({ probe: true, probeProvider: selectedProvider || undefined });
              }}
              disabled={isLoading || !selectedProvider}
            >
              {t("settings.page.models.probe.runProvider")}
            </Button>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {lastProbeAt
              ? t("settings.page.models.probe.lastRun", {
                  time: new Date(lastProbeAt).toLocaleString(),
                })
              : t("settings.page.models.probe.never")}
          </div>
        </CardContent>
      </Card>

      {/* OAuth Login */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.models.oauth.title")}</CardTitle>
          <CardDescription>{t("settings.page.models.oauth.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>{t("settings.page.models.oauth.method")}</Label>
            <Input
              value={authMethodInput}
              onChange={(event) => setAuthMethodInput(event.target.value)}
              placeholder={t("settings.page.models.oauth.methodPlaceholder")}
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                clearMessages();
                void runAuthLogin({
                  provider: selectedProvider || undefined,
                  method: authMethodInput.trim() || undefined,
                });
              }}
              disabled={isLoading}
            >
              {t("settings.page.models.oauth.login")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
