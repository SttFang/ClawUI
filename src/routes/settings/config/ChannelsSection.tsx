import {
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@clawui/ui";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChannelConfig } from "@/lib/ipc";
import { TelegramConfigDialog, DiscordConfigDialog } from "@/features/Channels";
import { getChannelBrandIcon } from "@/lib/channelBrandIcons";
import { useChannelsStore, selectChannels, type ChannelType } from "@/store/channels";

export function ChannelsSection() {
  const { t } = useTranslation("common");
  const channels = useChannelsStore(selectChannels);
  const { loadChannels, enableChannel, disableChannel, configureChannel } = useChannelsStore();

  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [discordDialogOpen, setDiscordDialogOpen] = useState(false);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const handleConfigure = (type: ChannelType) => {
    if (type === "telegram") {
      setTelegramDialogOpen(true);
    } else if (type === "discord") {
      setDiscordDialogOpen(true);
    }
  };

  const handleSaveConfig = async (type: ChannelType, config: ChannelConfig) => {
    await configureChannel(type, config);
  };

  const getChannelConfig = (type: ChannelType) => {
    const channel = channels.find((c) => c.type === type);
    return channel?.config ?? null;
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{t("channels.title")}</h2>
        <p className="text-muted-foreground">{t("channels.description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {channels.map((channel) => {
          const Icon = getChannelBrandIcon(channel.type);

          return (
            <Card key={channel.type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {Icon ? <Icon size={22} /> : <span className="text-2xl">{channel.icon}</span>}
                    <div>
                      <CardTitle className="text-lg">
                        {t(`channels.items.${channel.type}.name`, { defaultValue: channel.name })}
                      </CardTitle>
                      <CardDescription>
                        {t(`channels.items.${channel.type}.description`, {
                          defaultValue: channel.description,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={channel.isEnabled}
                    onCheckedChange={(checked) =>
                      checked ? enableChannel(channel.type) : disableChannel(channel.type)
                    }
                    disabled={!channel.isConfigured}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      channel.isConfigured ? "text-green-600" : "text-muted-foreground"
                    }`}
                  >
                    {channel.isConfigured
                      ? t("channels.status.configured")
                      : t("channels.status.notConfigured")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigure(channel.type)}
                    disabled={!channel.isEditable}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {channel.isEditable
                      ? t("channels.actions.configure")
                      : t("channels.status.readOnly", { defaultValue: "只读" })}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <TelegramConfigDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        config={getChannelConfig("telegram")}
        onSave={(config) => handleSaveConfig("telegram", config)}
      />

      <DiscordConfigDialog
        open={discordDialogOpen}
        onOpenChange={setDiscordDialogOpen}
        config={getChannelConfig("discord")}
        onSave={(config) => handleSaveConfig("discord", config)}
      />
    </>
  );
}
