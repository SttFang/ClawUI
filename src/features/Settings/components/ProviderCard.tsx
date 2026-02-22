import type { ProviderAuthInfo, OAuthProviderStatus } from "@clawui/types/models";
import { Button, Input } from "@clawui/ui";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import { getProviderBrandIcon } from "@/lib/providerBrandIcons";
import {
  getProviderLabel,
  getProviderOAuthMethod,
  getProviderCliLoginCommand,
} from "@/store/settings/providerRegistry";
import { OAuthLoginDialog } from "./OAuthLoginDialog";

function getAuthStatus(authInfo: ProviderAuthInfo, oauthStatus?: OAuthProviderStatus) {
  const { effective } = authInfo;

  if (effective.kind === "env" && effective.detail) {
    return { bg: "bg-green-500", kind: "ok" as const };
  }
  if (effective.kind === "profiles") {
    if (oauthStatus?.status === "ok") return { bg: "bg-green-500", kind: "ok" as const };
    if (oauthStatus?.status === "expired") return { bg: "bg-amber-500", kind: "expired" as const };
  }
  if (effective.kind === "token" && effective.detail) {
    return { bg: "bg-green-500", kind: "ok" as const };
  }
  if (effective.kind === "models.json" && effective.detail) {
    return { bg: "bg-green-500", kind: "ok" as const };
  }
  if (effective.kind === "none") {
    return { bg: "bg-gray-400", kind: "unconfigured" as const };
  }
  return { bg: "bg-red-500", kind: "missing" as const };
}

function useAuthDescription(authInfo: ProviderAuthInfo, oauthStatus?: OAuthProviderStatus) {
  const { t } = useTranslation("common");
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
  if (effective.kind === "models.json") {
    return effective.detail
      ? t("settings.providerCard.auth.modelsJson", { name: effective.detail })
      : t("settings.providerCard.auth.modelsJsonShort");
  }
  return t("settings.providerCard.auth.notConfigured");
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
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const Icon = getProviderBrandIcon(provider);
  const label = getProviderLabel(provider);
  const status = getAuthStatus(authInfo, oauthStatus);
  const authDesc = useAuthDescription(authInfo, oauthStatus);

  const isOAuthAuth = authInfo.effective.kind === "profiles";
  const hasOAuthProfiles = (authInfo.profiles?.oauth ?? 0) > 0;
  const oauthMethod = getProviderOAuthMethod(provider);
  const supportsOAuth = hasOAuthProfiles || isOAuthAuth || oauthMethod !== undefined;
  const isDeviceCode = oauthMethod === "device-code";
  const isExternalCli = oauthMethod === "external-cli";
  const cliLoginCommand = getProviderCliLoginCommand(provider);
  const canEditApiKey = !isOAuthAuth && canSaveApiKey;

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

  const hasExpandableContent = canEditApiKey || isOAuthAuth || supportsOAuth;

  return (
    <>
      <button
        type="button"
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon ? (
            <Icon size={18} />
          ) : (
            <div className="w-[18px] h-[18px] rounded bg-muted shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs text-muted-foreground font-mono truncate">{authDesc}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${status.bg}`} />
          {hasExpandableContent && (
            <ChevronRight
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          {/* OAuth: login + refresh */}
          {(isOAuthAuth || supportsOAuth) && (
            <div className="flex items-center gap-2">
              {isExternalCli ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t("settings.providerCard.oauth.externalCliHint")}
                  </p>
                  {cliLoginCommand && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => ipc.credentials.openCliLogin(cliLoginCommand)}
                    >
                      <Terminal className="mr-1.5 h-3.5 w-3.5" />
                      {t("settings.providerCard.oauth.openTerminal")}
                    </Button>
                  )}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setOauthDialogOpen(true)}>
                  <LogIn className="mr-1.5 h-3.5 w-3.5" />
                  {t("settings.providerCard.oauth.login")}
                </Button>
              )}
              {isOAuthAuth && (
                <Button variant="outline" size="sm" disabled={isRefreshing} onClick={handleRefresh}>
                  {isRefreshing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {t("settings.providerCard.refreshOAuth")}
                </Button>
              )}
            </div>
          )}

          {/* API key editor */}
          {canEditApiKey && (
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
              <Button variant="outline" size="sm" onClick={onApiKeySave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("actions.save")}
              </Button>
            </div>
          )}

          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("settings.providerCard.saved")}
            </span>
          )}

          {!isOAuthAuth && !canSaveApiKey && (
            <p className="text-xs text-muted-foreground">
              {t("settings.providerCard.unsupportedSaveHint")}
            </p>
          )}
        </div>
      )}

      {isDeviceCode && (
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
