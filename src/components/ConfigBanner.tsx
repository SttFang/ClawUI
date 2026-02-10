import { Button, Alert, AlertDescription, AlertTitle } from "@clawui/ui";
import { AlertCircle, Key, Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfigBannerProps {
  onDismiss?: () => void;
  onOneClick?: () => void;
  onManualConfig?: () => void;
}

/**
 * Banner shown in ChatPage when API keys are not configured.
 * Offers two options:
 * - One-click config (login) - not yet implemented
 * - Manual config (settings page)
 */
export function ConfigBanner({ onDismiss, onOneClick, onManualConfig }: ConfigBannerProps) {
  const { t } = useTranslation("common");

  return (
    <Alert className="mb-4 border-warning bg-warning/10">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{t("configBanner.title")}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-accent rounded-sm transition-colors"
            aria-label={t("actions.close")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">{t("configBanner.description")}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={onOneClick}>
            <Key className="mr-2 h-3 w-3" />
            {t("configBanner.oneClick")}
          </Button>
          <Button size="sm" variant="outline" onClick={onManualConfig}>
            <Settings className="mr-2 h-3 w-3" />
            {t("configBanner.manual")}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
