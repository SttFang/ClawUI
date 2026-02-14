import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@clawui/ui";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOAuthDeviceFlow } from "../hooks/useOAuthDeviceFlow";

interface OAuthLoginDialogProps {
  provider: string;
  providerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OAuthLoginDialog({
  provider,
  providerLabel,
  open,
  onOpenChange,
  onSuccess,
}: OAuthLoginDialogProps) {
  const { t } = useTranslation("common");
  const {
    phase,
    userCode,
    verificationUri,
    errorMessage,
    copied,
    startFlow,
    handleCopy,
    handleClose,
  } = useOAuthDeviceFlow({ provider, onSuccess, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("settings.providerCard.oauth.dialogTitle", { provider: providerLabel })}
          </DialogTitle>
          <DialogDescription>
            {t("settings.providerCard.oauth.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {phase === "idle" && (
            <Button onClick={startFlow} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("settings.providerCard.oauth.startLogin")}
            </Button>
          )}

          {phase === "requesting" && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase === "waiting" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.providerCard.oauth.visitUrl")}
              </p>
              <a
                href={verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-mono text-primary underline"
              >
                {verificationUri}
              </a>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-center font-mono text-lg tracking-widest">
                  {userCode}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  {copied ? t("settings.providerCard.oauth.copied") : ""}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("settings.providerCard.oauth.waitingAuth")}
              </div>
            </div>
          )}

          {phase === "success" && (
            <p className="text-sm text-green-600 font-medium">
              {t("settings.providerCard.oauth.loginSuccess")}
            </p>
          )}

          {phase === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={startFlow}>
                {t("settings.providerCard.oauth.retry")}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant={phase === "success" ? "default" : "outline"}
            onClick={() => handleClose(false)}
          >
            {phase === "success" ? t("actions.close") : t("actions.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
