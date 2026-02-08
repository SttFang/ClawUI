import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGatewayStore, selectGatewayStatus, selectGatewayError } from '@/store/gateway'
import { Key, Server, Info } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const status = useGatewayStore(selectGatewayStatus)
  const error = useGatewayStore(selectGatewayError)
  const { start, stop } = useGatewayStore()
  const [version, setVersion] = useState('0.0.0')

  useEffect(() => {
    ipc.app.getVersion().then(setVersion)
  }, [])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your CatchClaw application
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="gateway">Gateway</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic application configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable dark theme for the application
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-start Gateway</Label>
                    <p className="text-sm text-muted-foreground">
                      Start the gateway when the app launches
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Check for Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically check for app updates
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  <CardTitle>API Keys</CardTitle>
                </div>
                <CardDescription>
                  Configure your AI provider API keys
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    placeholder="sk-ant-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                  <Input
                    id="openrouter-key"
                    type="password"
                    placeholder="sk-or-..."
                  />
                </div>
                <Button>Save API Keys</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gateway">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  <CardTitle>Gateway Settings</CardTitle>
                </div>
                <CardDescription>
                  Configure the OpenClaw Gateway
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Status</Label>
                    <p className="text-sm text-muted-foreground capitalize">
                      {status}
                      {error && <span className="text-destructive"> - {error}</span>}
                    </p>
                  </div>
                  <Button
                    variant={status === 'running' ? 'destructive' : 'default'}
                    onClick={() => (status === 'running' ? stop() : start())}
                    disabled={status === 'starting'}
                  >
                    {status === 'running' ? 'Stop' : 'Start'} Gateway
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gateway-port">Port</Label>
                  <Input
                    id="gateway-port"
                    type="number"
                    defaultValue={18789}
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gateway-token">Gateway Token</Label>
                  <Input
                    id="gateway-token"
                    type="password"
                    placeholder="Auto-generated"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  <CardTitle>About CatchClaw</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">CatchClaw</p>
                  <p className="text-sm text-muted-foreground">
                    Version {version}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A desktop application for OpenClaw, providing an easy-to-use
                  interface for managing AI assistants across multiple messaging
                  platforms.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Check for Updates
                  </Button>
                  <Button variant="outline" size="sm">
                    View License
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
