import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@clawui/ui";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  selectModelConfigCatalog,
  selectModelConfigError,
  selectModelConfigFallbacks,
  selectModelConfigLastProbeAt,
  selectModelConfigLoading,
  selectModelConfigSelectedProvider,
  selectModelConfigStatus,
  selectModelConfigSuccess,
  useModelConfigStore,
} from "@/store/modelConfig";

function toCommaList(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return "";
  return value.join(", ");
}

function parseCommaList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ModelsTab() {
  const { t } = useTranslation("common");

  const status = useModelConfigStore(selectModelConfigStatus);
  const catalog = useModelConfigStore(selectModelConfigCatalog);
  const fallbacks = useModelConfigStore(selectModelConfigFallbacks);
  const selectedProvider = useModelConfigStore(selectModelConfigSelectedProvider);
  const error = useModelConfigStore(selectModelConfigError);
  const success = useModelConfigStore(selectModelConfigSuccess);
  const isLoading = useModelConfigStore(selectModelConfigLoading);
  const lastProbeAt = useModelConfigStore(selectModelConfigLastProbeAt);

  const loadAll = useModelConfigStore((s) => s.loadAll);
  const clearMessages = useModelConfigStore((s) => s.clearMessages);
  const setDefaultModel = useModelConfigStore((s) => s.setDefaultModel);
  const addFallback = useModelConfigStore((s) => s.addFallback);
  const removeFallback = useModelConfigStore((s) => s.removeFallback);
  const clearFallbacks = useModelConfigStore((s) => s.clearFallbacks);
  const loadStatus = useModelConfigStore((s) => s.loadStatus);
  const setSelectedProvider = useModelConfigStore((s) => s.setSelectedProvider);
  const loadAuthOrder = useModelConfigStore((s) => s.loadAuthOrder);
  const saveAuthOrder = useModelConfigStore((s) => s.saveAuthOrder);
  const clearAuthOrder = useModelConfigStore((s) => s.clearAuthOrder);
  const runAuthLogin = useModelConfigStore((s) => s.runAuthLogin);
  const authOrderByProvider = useModelConfigStore((s) => s.authOrderByProvider);

  const [fallbackInput, setFallbackInput] = useState("");
  const [authOrderInput, setAuthOrderInput] = useState("");
  const [authMethodInput, setAuthMethodInput] = useState("");

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const provider = selectedProvider.trim();
    if (!provider) return;
    void loadAuthOrder(provider);
  }, [loadAuthOrder, selectedProvider]);

  useEffect(() => {
    const current = authOrderByProvider[selectedProvider]?.order ?? null;
    setAuthOrderInput(toCommaList(current));
  }, [authOrderByProvider, selectedProvider]);

  const providerOptions = useMemo(
    () => status?.auth.providers.map((provider) => provider.provider).filter(Boolean) ?? [],
    [status],
  );

  const defaultModel = status?.defaultModel ?? "";
  const authOrderValue = authOrderByProvider[selectedProvider]?.order ?? null;

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

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.models.defaultModel.title")}</CardTitle>
          <CardDescription>{t("settings.page.models.defaultModel.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>{t("settings.page.models.defaultModel.label")}</Label>
            <Select
              value={defaultModel}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                clearMessages();
                void setDefaultModel(event.target.value);
              }}
              disabled={isLoading}
            >
              {catalog.map((model) => (
                <option key={model.key} value={model.key}>
                  {model.key}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("settings.page.models.defaultModel.current", { model: defaultModel || "-" })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.page.models.fallbacks.title")}</CardTitle>
          <CardDescription>{t("settings.page.models.fallbacks.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={fallbackInput}
              onChange={(event) => setFallbackInput(event.target.value)}
              placeholder={t("settings.page.models.fallbacks.placeholder")}
              disabled={isLoading}
            />
            <Button
              onClick={() => {
                clearMessages();
                void addFallback(fallbackInput);
                setFallbackInput("");
              }}
              disabled={isLoading || !fallbackInput.trim()}
            >
              {t("settings.page.models.fallbacks.add")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearMessages();
                void clearFallbacks();
              }}
              disabled={isLoading || fallbacks.length === 0}
            >
              {t("settings.page.models.fallbacks.clear")}
            </Button>
          </div>
          <div className="space-y-2">
            {fallbacks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {t("settings.page.models.fallbacks.empty")}
              </div>
            ) : (
              fallbacks.map((model) => (
                <div
                  key={model}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm">{model}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      clearMessages();
                      void removeFallback(model);
                    }}
                    disabled={isLoading}
                  >
                    {t("settings.page.models.fallbacks.remove")}
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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
                value: toCommaList(authOrderValue) || t("settings.page.models.authOrder.inherit"),
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
