import type { ProviderAuthInfo, OAuthProviderStatus } from "@clawui/types/models";
import { Button, Input } from "@clawui/ui";
import { CheckCircle2, Loader2, Edit3, Eye, EyeOff, LogIn, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { getProviderBrandIcon } from "@/lib/providerBrandIcons";
import { getProviderLabel } from "@/store/settings/providerRegistry";
import { OAuthLoginDialog } from "./OAuthLoginDialog";

/** Providers that support device code OAuth flow. */
const DEVICE_CODE_PROVIDERS = new Set(["github-copilot"]);

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
  if (effective.kind === "none") {
    return { color: "text-muted-foreground", bg: "bg-gray-400", kind: "unconfigured" as const };
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
  onOAuthAction?: () => void;
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
  onOAuthAction,
}: ProviderCardProps) {
  const { t } = useTranslation("common");
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const isTokenAuth = authInfo.effective.kind === "token";
  const isOAuthAuth = authInfo.effective.kind === "profiles";
  const isMissing = status.kind === "missing" || status.kind === "unconfigured";
  const statusLabel = t(`settings.providerCard.status.${status.kind}`);
  const canEditApiKey = (isEnvAuth || isTokenAuth) && canSaveApiKey;
  const supportsDeviceCode = DEVICE_CODE_PROVIDERS.has(provider);

  const handleRefresh = useCallback(async () => {
    const profileId = oauthStatus?.profiles?.[0]?.profileId;
    if (!profileId) return;
    setIsRefreshing(true);
    try {
      await ipc.credentials.oauthRefresh(profileId);
      onOAuthAction?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [oauthStatus, onOAuthAction]);

  return (
    <>
      <div className="rounded-lg border px-4 py-3 space-y-2">
        {/* Header: icon + name + auth + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {Icon ? <Icon size={18} /> : <div className="w-[18px] h-[18px] rounded bg-muted" />}
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground font-mono">{authDesc}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
            <span className={`text-xs ${status.color}`}>{statusLabel}</span>
          </div>
        </div>

        {/* OAuth provider: login + refresh */}
        {isOAuthAuth && (
          <div className="flex items-center gap-2">
            {supportsDeviceCode && (
              <Button variant="outline" size="sm" onClick={() => setOauthDialogOpen(true)}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                {t("settings.providerCard.oauth.login")}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={isRefreshing} onClick={handleRefresh}>
              {isRefreshing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("settings.providerCard.refreshOAuth")}
            </Button>
          </div>
        )}

        {/* Missing auth + supports OAuth: offer login */}
        {isMissing && supportsDeviceCode && (
          <Button variant="outline" size="sm" onClick={() => setOauthDialogOpen(true)}>
            <LogIn className="mr-1.5 h-3.5 w-3.5" />
            {t("settings.providerCard.oauth.login")}
          </Button>
        )}

        {/* API key / token editor */}
        {canEditApiKey && (
          <div className="space-y-2">
            {isMissing || isEditing ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder={t("settings.providerCard.apiKeyPlaceholder", {
                      provider: label,
                    })}
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

        {(isEnvAuth || isTokenAuth) && !canSaveApiKey && (
          <p className="text-xs text-muted-foreground">
            {t("settings.providerCard.unsupportedSaveHint")}
          </p>
        )}
      </div>

      {supportsDeviceCode && (
        <OAuthLoginDialog
          provider={provider}
          providerLabel={label}
          open={oauthDialogOpen}
          onOpenChange={setOauthDialogOpen}
          onSuccess={onOAuthAction}
        />
      )}
    </>
  );
}
