import { useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@clawui/ui'
import { useGatewayStore, selectGatewayStatus, selectGatewayError, selectIsGatewayRunning } from '@/store/gateway'
import { useUIStore, selectTheme, type Theme } from '@/store/ui'
import {
  useSettingsStore,
  selectApiKeys,
  selectAutoStartGateway,
  selectAutoCheckUpdates,
  selectIsSaving,
  selectSaveSuccess,
  selectError,
} from '@/store/settings'
import { Key, Server, Info, CheckCircle2, Loader2, Moon, Sun, Monitor, AlertCircle } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { useState } from 'react'
import { Subscription } from '@/features/Subscription'

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
]

export default function SettingsPage() {
  // Gateway store
  const gatewayStatus = useGatewayStore(selectGatewayStatus)
  const gatewayError = useGatewayStore(selectGatewayError)
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning)
  const startGateway = useGatewayStore((s) => s.start)
  const stopGateway = useGatewayStore((s) => s.stop)

  // UI store
  const theme = useUIStore(selectTheme)
  const setTheme = useUIStore((s) => s.setTheme)

  // Settings store
  const apiKeys = useSettingsStore(selectApiKeys)
  const autoStartGateway = useSettingsStore(selectAutoStartGateway)
  const autoCheckUpdates = useSettingsStore(selectAutoCheckUpdates)
  const isSaving = useSettingsStore(selectIsSaving)
  const saveSuccess = useSettingsStore(selectSaveSuccess)
  const settingsError = useSettingsStore(selectError)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const saveApiKeys = useSettingsStore((s) => s.saveApiKeys)
  const setAutoStartGateway = useSettingsStore((s) => s.setAutoStartGateway)
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates)

  const [version, setVersion] = useState('0.0.0')

  useEffect(() => {
    loadSettings()
    ipc.app.getVersion().then(setVersion)
  }, [loadSettings])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your ClawUI preferences
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="gateway">Gateway</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how ClawUI looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="flex gap-2">
                    {themeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                          theme === option.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Startup</CardTitle>
                <CardDescription>Configure startup behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-start Gateway</Label>
                    <p className="text-sm text-muted-foreground">
                      Start Gateway automatically when app launches
                    </p>
                  </div>
                  <Switch
                    checked={autoStartGateway}
                    onCheckedChange={setAutoStartGateway}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-check Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Check for updates on startup
                    </p>
                  </div>
                  <Switch
                    checked={autoCheckUpdates}
                    onCheckedChange={setAutoCheckUpdates}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  <CardTitle>API Keys</CardTitle>
                </div>
                <CardDescription>
                  Configure your AI provider API keys. Keys are stored locally and encrypted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKey('anthropic', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKeys.openai}
                    onChange={(e) => setApiKey('openai', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                  <Input
                    id="openrouter-key"
                    type="password"
                    placeholder="sk-or-..."
                    value={apiKeys.openrouter}
                    onChange={(e) => setApiKey('openrouter', e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={saveApiKeys} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save API Keys'
                    )}
                  </Button>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-sm text-green-500">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved!
                    </span>
                  )}
                  {settingsError && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {settingsError}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gateway Tab */}
          <TabsContent value="gateway">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  <CardTitle>Gateway Status</CardTitle>
                </div>
                <CardDescription>
                  OpenClaw Gateway manages AI connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        gatewayStatus === 'running'
                          ? 'bg-green-500'
                          : gatewayStatus === 'starting'
                            ? 'bg-amber-500 animate-pulse'
                            : gatewayStatus === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                      }`}
                    />
                    <span className="capitalize">{gatewayStatus}</span>
                    {gatewayError && <span className="text-destructive"> - {gatewayError}</span>}
                  </div>
                  <Button
                    variant={isGatewayRunning ? 'destructive' : 'default'}
                    onClick={isGatewayRunning ? stopGateway : startGateway}
                    disabled={gatewayStatus === 'starting'}
                  >
                    {isGatewayRunning ? 'Stop' : 'Start'} Gateway
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <Subscription />
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  <CardTitle>About ClawUI</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">ClawUI</p>
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
                  <Button variant="outline" size="sm" onClick={() => ipc.app.checkForUpdates()}>
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
