import type { ChangeEvent } from "react";
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
import { useTranslation } from "react-i18next";
import { useModelConfig, useAuthOrderForm, parseCommaList } from "./hooks";

export function ModelsTab() {
  const { t } = useTranslation("common");
  const config = useModelConfig();
  const form = useAuthOrderForm(config);

  const {
    catalog,
    fallbacks,
    selectedProvider,
    error,
    success,
    isLoading,
    lastProbeAt,
    defaultModel,
    clearMessages,
    setDefaultModel,
    addFallback,
    removeFallback,
    clearFallbacks,
    loadStatus,
    setSelectedProvider,
    saveAuthOrder,
    clearAuthOrder,
    loadAuthOrder,
    runAuthLogin,
  } = config;

  const {
    fallbackInput,
    setFallbackInput,
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
