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

interface DiscordConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ChannelConfig | null;
  onSave: (config: ChannelConfig) => Promise<void>;
}

type DiscordFields = {
  botToken: string;
  dmPolicy: string;
  groupPolicy: string;
  requireMention: boolean;
};

export function DiscordConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: DiscordConfigDialogProps) {
  const { t } = useTranslation("common");

  const { fields, setField, isLoading, error, handleSave } = useDialogForm<DiscordFields>({
    config: config
      ? {
          botToken: config.botToken || "",
          dmPolicy: config.dmPolicy || "pairing",
          groupPolicy: config.groupPolicy || "allowlist",
          requireMention: config.requireMention ?? true,
        }
      : null,
    defaults: {
      botToken: "",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      requireMention: true,
    },
    onSave: (values) =>
      onSave({
        enabled: true,
        botToken: values.botToken,
        dmPolicy: values.dmPolicy as ChannelConfig["dmPolicy"],
        groupPolicy: values.groupPolicy as ChannelConfig["groupPolicy"],
        requireMention: values.requireMention,
      }),
    onClose: () => onOpenChange(false),
    logger: channelsLog,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t("channels.discord.configTitle")}</DialogTitle>
          <DialogDescription>{t("channels.discord.configDescription")}</DialogDescription>
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
              placeholder={t("channels.fields.botToken")}
              value={fields.botToken}
              onChange={(e) => setField("botToken", e.target.value)}
            />
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
            <Label htmlFor="groupPolicy">{t("channels.policies.groupDiscord")}</Label>
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
                {t("channels.fields.requireMentionChannelsHint")}
              </p>
            </div>
            <Switch
              checked={fields.requireMention}
              onCheckedChange={(v) => setField("requireMention", v)}
            />
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
