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
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ChannelConfig } from "@/lib/ipc";
import { channelsLog } from "@/lib/logger";

interface TelegramConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ChannelConfig | null;
  onSave: (config: ChannelConfig) => Promise<void>;
}

export function TelegramConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: TelegramConfigDialogProps) {
  const { t } = useTranslation("common");
  const [isLoading, setIsLoading] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [dmPolicy, setDmPolicy] = useState<string>("pairing");
  const [groupPolicy, setGroupPolicy] = useState<string>("allowlist");
  const [requireMention, setRequireMention] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(50);

  useEffect(() => {
    if (config) {
      setBotToken(config.botToken || "");
      setDmPolicy(config.dmPolicy || "pairing");
      setGroupPolicy(config.groupPolicy || "allowlist");
      setRequireMention(config.requireMention ?? true);
      setHistoryLimit(config.historyLimit ?? 50);
    }
  }, [config]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave({
        enabled: true,
        botToken,
        dmPolicy: dmPolicy as ChannelConfig["dmPolicy"],
        groupPolicy: groupPolicy as ChannelConfig["groupPolicy"],
        requireMention,
        historyLimit,
      });
      onOpenChange(false);
    } catch (error) {
      channelsLog.error("Failed to save config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t("channels.telegram.configTitle")}</DialogTitle>
          <DialogDescription>{t("channels.telegram.configDescription")}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">{t("channels.fields.botToken")}</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
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
            <Select id="dmPolicy" value={dmPolicy} onChange={(e) => setDmPolicy(e.target.value)}>
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
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
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
            <Switch checked={requireMention} onCheckedChange={setRequireMention} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="historyLimit">{t("channels.fields.historyLimit")}</Label>
            <Input
              id="historyLimit"
              type="number"
              min={1}
              max={200}
              value={historyLimit}
              onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">{t("channels.fields.historyLimitHint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !botToken}>
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
