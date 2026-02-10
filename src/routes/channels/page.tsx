import { useEffect, useState } from 'react'
import {
  useChannelsStore,
  selectChannels,
  type ChannelType,
} from '@/store/channels'
import { useTranslation } from 'react-i18next'
import {
  Switch,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from '@clawui/ui'
import { Settings } from 'lucide-react'
import {
  TelegramConfigDialog,
  DiscordConfigDialog,
} from '@/features/Channels'
import type { ChannelConfig } from '@/lib/ipc'

export default function ChannelsPage() {
  const { t } = useTranslation('common')
  const channels = useChannelsStore(selectChannels)
  const { loadChannels, enableChannel, disableChannel, configureChannel } =
    useChannelsStore()

  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false)
  const [discordDialogOpen, setDiscordDialogOpen] = useState(false)

  useEffect(() => {
    loadChannels()
  }, [])

  const handleConfigure = (type: ChannelType) => {
    if (type === 'telegram') {
      setTelegramDialogOpen(true)
    } else if (type === 'discord') {
      setDiscordDialogOpen(true)
    }
  }

  const handleSaveConfig = async (
    type: ChannelType,
    config: ChannelConfig
  ) => {
    await configureChannel(type, config)
  }

  const getChannelConfig = (type: ChannelType) => {
    const channel = channels.find((c) => c.type === type)
    return channel?.config ?? null
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t('channels.title')}</h1>
          <p className="text-muted-foreground">{t('channels.description')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{channel.icon}</span>
                    <div>
                      <CardTitle className="text-lg">
                        {t(`channels.items.${channel.type}.name`, { defaultValue: channel.name })}
                      </CardTitle>
                      <CardDescription>
                        {t(`channels.items.${channel.type}.description`, { defaultValue: channel.description })}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={channel.isEnabled}
                    onCheckedChange={(checked) =>
                      checked
                        ? enableChannel(channel.type)
                        : disableChannel(channel.type)
                    }
                    disabled={!channel.isConfigured}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      channel.isConfigured
                        ? 'text-green-600'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {channel.isConfigured ? t('channels.status.configured') : t('channels.status.notConfigured')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigure(channel.type)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {t('channels.actions.configure')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <TelegramConfigDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        config={getChannelConfig('telegram')}
        onSave={(config) => handleSaveConfig('telegram', config)}
      />

      <DiscordConfigDialog
        open={discordDialogOpen}
        onOpenChange={setDiscordDialogOpen}
        config={getChannelConfig('discord')}
        onSave={(config) => handleSaveConfig('discord', config)}
      />
    </div>
  )
}
