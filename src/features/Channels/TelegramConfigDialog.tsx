import {
  Button,
  Input,
  Label,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
} from "@clawui/ui";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChannelConfig } from "@/lib/ipc";
import { useDialogForm } from "@/hooks/useDialogForm";
import { channelsLog } from "@/lib/logger";

interface TelegramConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ChannelConfig | null;
  onSave: (config: ChannelConfig) => Promise<void>;
}

type TelegramFields = {
  botToken: string;
  dmPolicy: string;
  groupPolicy: string;
  requireMention: boolean;
  historyLimit: number;
};

export function TelegramConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: TelegramConfigDialogProps) {
  const { t } = useTranslation("common");

  const { fields, setField, isLoading, error, handleSave } = useDialogForm<TelegramFields>({
    config: config
      ? {
          botToken: config.botToken || "",
          dmPolicy: config.dmPolicy || "pairing",
          groupPolicy: config.groupPolicy || "allowlist",
          requireMention: config.requireMention ?? true,
          historyLimit: config.historyLimit ?? 50,
        }
      : null,
    defaults: {
      botToken: "",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      requireMention: true,
      historyLimit: 50,
    },
    onSave: (values) =>
      onSave({
        enabled: true,
        botToken: values.botToken,
        dmPolicy: values.dmPolicy as ChannelConfig["dmPolicy"],
        groupPolicy: values.groupPolicy as ChannelConfig["groupPolicy"],
        requireMention: values.requireMention,
        historyLimit: values.historyLimit,
      }),
    onClose: () => onOpenChange(false),
    logger: channelsLog,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t("channels.telegram.configTitle")}</DialogTitle>
          <DialogDescription>{t("channels.telegram.configDescription")}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="botToken">{t("channels.fields.botToken")}</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={fields.botToken}
              onChange={(e) => setField("botToken", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("channels.telegram.botTokenHelpPrefix")}{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                @BotFather
              </a>
              {t("channels.telegram.botTokenHelpSuffix")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dmPolicy">{t("channels.policies.dm")}</Label>
            <Select
              id="dmPolicy"
              value={fields.dmPolicy}
              onChange={(e) => setField("dmPolicy", e.target.value)}
            >
              <option value="pairing">{t("channels.policies.pairing")}</option>
              <option value="allowlist">{t("channels.policies.allowlist")}</option>
              <option value="open">{t("channels.policies.open")}</option>
              <option value="disabled">{t("channels.policies.disabled")}</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPolicy">{t("channels.policies.groupTelegram")}</Label>
            <Select
              id="groupPolicy"
              value={fields.groupPolicy}
              onChange={(e) => setField("groupPolicy", e.target.value)}
            >
              <option value="allowlist">{t("channels.policies.allowlist")}</option>
              <option value="open">{t("channels.policies.open")}</option>
              <option value="disabled">{t("channels.policies.disabled")}</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t("channels.fields.requireMention")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("channels.fields.requireMentionGroupsHint")}
              </p>
            </div>
            <Switch
              checked={fields.requireMention}
              onCheckedChange={(v) => setField("requireMention", v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="historyLimit">{t("channels.fields.historyLimit")}</Label>
            <Input
              id="historyLimit"
              type="number"
              min={1}
              max={200}
              value={fields.historyLimit}
              onChange={(e) => setField("historyLimit", parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">{t("channels.fields.historyLimitHint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !fields.botToken}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("status.saving")}
              </>
            ) : (
              t("actions.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
