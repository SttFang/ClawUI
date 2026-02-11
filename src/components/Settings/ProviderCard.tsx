import type { ProviderAuthInfo, OAuthProviderStatus } from "@clawui/types/models";
import { Card, CardContent, Button, Input } from "@clawui/ui";
import { CheckCircle2, Loader2, Clock, Edit3, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getProviderBrandIcon } from "@/lib/providerBrandIcons";
import { getProviderLabel } from "@/store/settings/providerRegistry";

function getAuthStatus(authInfo: ProviderAuthInfo, oauthStatus?: OAuthProviderStatus) {
  const { effective } = authInfo;

  if (effective.kind === "env" && effective.detail) {
    return { color: "text-green-500", bg: "bg-green-500", kind: "ok" as const };
  }
  if (effective.kind === "profiles") {
    if (oauthStatus?.status === "ok") {
      return { color: "text-green-500", bg: "bg-green-500", kind: "ok" as const };
    }
    if (oauthStatus?.status === "expired") {
      return { color: "text-amber-500", bg: "bg-amber-500", kind: "expired" as const };
    }
  }
  if (effective.kind === "token" && effective.detail) {
    return { color: "text-green-500", bg: "bg-green-500", kind: "ok" as const };
  }
  return { color: "text-red-500", bg: "bg-red-500", kind: "missing" as const };
}

interface ProviderCardProps {
  provider: string;
  authInfo: ProviderAuthInfo;
  oauthStatus?: OAuthProviderStatus;
  apiKeyValue: string;
  onApiKeyChange: (value: string) => void;
  onApiKeySave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  canSaveApiKey: boolean;
}

export function ProviderCard({
  provider,
  authInfo,
  oauthStatus,
  apiKeyValue,
  onApiKeyChange,
  onApiKeySave,
  isSaving,
  saveSuccess,
  canSaveApiKey,
}: ProviderCardProps) {
  const { t } = useTranslation("common");
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const Icon = getProviderBrandIcon(provider);
  const label = getProviderLabel(provider);
  const status = getAuthStatus(authInfo, oauthStatus);
  const authDesc = (() => {
    const { effective } = authInfo;

    if (effective.kind === "env") {
      return effective.detail
        ? t("settings.providerCard.auth.envVar", { name: effective.detail })
        : t("settings.providerCard.auth.envVarNotSet");
    }
    if (effective.kind === "profiles") {
      const profile = oauthStatus?.profiles?.[0];
      if (profile?.expiresAt) {
        const date = new Date(profile.expiresAt).toLocaleDateString();
        return t("settings.providerCard.auth.oauthExpires", { date });
      }
      return t("settings.providerCard.auth.oauth");
    }
    if (effective.kind === "token") {
      return effective.detail
        ? t("settings.providerCard.auth.token", { name: effective.detail })
        : t("settings.providerCard.auth.tokenShort");
    }
    return t("settings.providerCard.auth.notConfigured");
  })();
  const isEnvAuth = authInfo.effective.kind === "env" || authInfo.effective.kind === "none";
  const isOAuthAuth = authInfo.effective.kind === "profiles";
  const isMissing = status.kind === "missing";
  const statusLabel = t(`settings.providerCard.status.${status.kind}`);
  const canEditApiKey = isEnvAuth && canSaveApiKey;

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header: icon + name + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon ? <Icon size={20} /> : <div className="w-5 h-5 rounded bg-muted" />}
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${status.bg}`} />
            <span className={`text-sm ${status.color}`}>{statusLabel}</span>
          </div>
        </div>

        {/* Auth description */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {status.kind === "expired" ? (
            <Clock className="h-3.5 w-3.5" />
          ) : (
            <span className="text-xs">{t("settings.providerCard.authLabel")}</span>
          )}
          <span className="font-mono text-xs">{authDesc}</span>
        </div>

        {/* OAuth provider: show refresh button */}
        {isOAuthAuth && (
          <Button variant="outline" size="sm" disabled>
            {t("settings.providerCard.refreshOAuth")}
          </Button>
        )}

        {/* Env/none auth: show API key editor */}
        {canEditApiKey && (
          <div className="space-y-2">
            {isMissing || isEditing ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={t("settings.providerCard.apiKeyPlaceholder", { provider: label })}
                    value={apiKeyValue}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onApiKeySave();
                    setIsEditing(false);
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.save")}
                </Button>
                {!isMissing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    {t("actions.cancel")}
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t("settings.providerCard.editKey")}
              </Button>
            )}
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("settings.providerCard.saved")}
              </span>
            )}
          </div>
        )}

        {isEnvAuth && !canSaveApiKey && (
          <p className="text-xs text-muted-foreground">
            {t("settings.providerCard.unsupportedSaveHint")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
