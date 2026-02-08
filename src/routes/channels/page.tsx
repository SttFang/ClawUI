import { useEffect } from 'react'
import { useChannelsStore, selectChannels } from '@/store/channels'
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

export default function ChannelsPage() {
  const channels = useChannelsStore(selectChannels)
  const { loadChannels, enableChannel, disableChannel } = useChannelsStore()

  useEffect(() => {
    loadChannels()
  }, [])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Channels</h1>
          <p className="text-muted-foreground">
            Connect messaging platforms to your AI assistant
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{channel.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{channel.name}</CardTitle>
                      <CardDescription>{channel.description}</CardDescription>
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
                    {channel.isConfigured ? 'Configured' : 'Not configured'}
                  </span>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
