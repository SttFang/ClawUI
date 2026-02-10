import { useEffect, useCallback, type ChangeEvent } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@clawui/ui'
import { useTranslation } from 'react-i18next'
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
  selectModelsStatus,
  selectModelsLoading,
} from '@/store/settings'
import {
  useSecretsStore,
  selectSecretsLoading,
  selectSecretsSaving,
  selectSecretsError,
  selectSecretsSaveSuccess,
} from '@/store/secrets'
import { Key, Server, Info, CheckCircle2, Loader2, Moon, Sun, Monitor, AlertCircle } from 'lucide-react'
import { ipc } from '@/lib/ipc'
import { useState } from 'react'
import { Subscription } from '@/features/Subscription'
import { ProviderCard } from '@/components/Settings/ProviderCard'
import { ModelConfig } from '@/components/Settings/ModelConfig'
import type { OAuthProviderStatus } from '@clawui/types/models'

/** Map provider name to apiKeys store key */
function mapProviderToKey(provider: string): 'anthropic' | 'openai' | 'openrouter' {
  if (provider === 'openai-codex') return 'openai'
  if (provider === 'anthropic') return 'anthropic'
  if (provider === 'openrouter') return 'openrouter'
  return 'openai'
}

function findOAuthStatus(
  modelsStatus: { auth: { oauthStatus?: { providers: OAuthProviderStatus[] } } },
  provider: string,
): OAuthProviderStatus | undefined {
  return modelsStatus.auth.oauthStatus?.providers.find((p) => p.provider === provider)
}

export default function SettingsPage() {
  const { t } = useTranslation('common')

  // Gateway store
  const gatewayStatus = useGatewayStore(selectGatewayStatus)
  const gatewayError = useGatewayStore(selectGatewayError)
  const isGatewayRunning = useGatewayStore(selectIsGatewayRunning)
  const startGateway = useGatewayStore((s) => s.start)
  const stopGateway = useGatewayStore((s) => s.stop)

  // UI store
  const theme = useUIStore(selectTheme)
  const setTheme = useUIStore((s) => s.setTheme)
  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: t('settings.page.theme.light'), icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: t('settings.page.theme.dark'), icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: t('settings.page.theme.system'), icon: <Monitor className="h-4 w-4" /> },
  ]

  // Settings store
  const apiKeys = useSettingsStore(selectApiKeys)
  const autoStartGateway = useSettingsStore(selectAutoStartGateway)
  const autoCheckUpdates = useSettingsStore(selectAutoCheckUpdates)
  const isSaving = useSettingsStore(selectIsSaving)
  const saveSuccess = useSettingsStore(selectSaveSuccess)
  const settingsError = useSettingsStore(selectError)
  const modelsStatus = useSettingsStore(selectModelsStatus)
  const modelsLoading = useSettingsStore(selectModelsLoading)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const setApiKey = useSettingsStore((s) => s.setApiKey)
  const saveApiKeys = useSettingsStore((s) => s.saveApiKeys)
  const setAutoStartGateway = useSettingsStore((s) => s.setAutoStartGateway)
  const setAutoCheckUpdates = useSettingsStore((s) => s.setAutoCheckUpdates)
  const loadModelsStatus = useSettingsStore((s) => s.loadModelsStatus)
  const loadPreferences = useSettingsStore((s) => s.loadPreferences)

  // Secrets store (non-model tokens/keys; managed via allowlisted env vars)
  const secretsLoading = useSecretsStore(selectSecretsLoading)
  const secretsSaving = useSecretsStore(selectSecretsSaving)
  const secretsError = useSecretsStore(selectSecretsError)
  const secretsSaveSuccess = useSecretsStore(selectSecretsSaveSuccess)
  const discordBotToken = useSecretsStore((s) => s.discordBotToken)
  const discordAppToken = useSecretsStore((s) => s.discordAppToken)
  const telegramBotToken = useSecretsStore((s) => s.telegramBotToken)
  const slackBotToken = useSecretsStore((s) => s.slackBotToken)
  const slackAppToken = useSecretsStore((s) => s.slackAppToken)
  const loadSecrets = useSecretsStore((s) => s.load)
  const setSecretValue = useSecretsStore((s) => s.setValue)
  const saveSecrets = useSecretsStore((s) => s.save)

  const [version, setVersion] = useState('0.0.0')
  const [gatewayServiceBusy, setGatewayServiceBusy] = useState(false)
  const [gatewayServiceMessage, setGatewayServiceMessage] = useState<string | null>(null)
  const [securityLoading, setSecurityLoading] = useState(false)
  const [securityMessage, setSecurityMessage] = useState<string | null>(null)
  const [allowElevatedWebchat, setAllowElevatedWebchat] = useState(false)
  const [allowElevatedDiscord, setAllowElevatedDiscord] = useState(false)
  const [sandboxMode, setSandboxMode] = useState<'off' | 'docker' | 'native' | string>('off')
  const [workspaceAccess, setWorkspaceAccess] = useState<'none' | 'ro' | 'rw' | string>('rw')

  useEffect(() => {
    loadSettings()
    loadPreferences()
    loadModelsStatus()
    loadSecrets()
    ipc.app.getVersion().then(setVersion)
  }, [loadSettings, loadPreferences, loadModelsStatus, loadSecrets])

  useEffect(() => {
    setSecurityLoading(true)
    ipc.security
      .get([
        'tools.elevated.allowFrom.webchat',
        'tools.elevated.allowFrom.discord',
        'agents.defaults.sandbox.mode',
        'agents.defaults.sandbox.workspaceAccess',
      ])
      .then((values) => {
        setAllowElevatedWebchat(values['tools.elevated.allowFrom.webchat'] === true)
        setAllowElevatedDiscord(values['tools.elevated.allowFrom.discord'] === true)
        const sm = values['agents.defaults.sandbox.mode']
        if (typeof sm === 'string') setSandboxMode(sm)
        const wa = values['agents.defaults.sandbox.workspaceAccess']
        if (typeof wa === 'string') setWorkspaceAccess(wa)
      })
      .catch((e) => setSecurityMessage(e instanceof Error ? e.message : 'Failed to load security settings'))
      .finally(() => setSecurityLoading(false))
  }, [])

  const handleApiKeyChange = useCallback(
    (provider: string) => (value: string) => {
      setApiKey(mapProviderToKey(provider), value)
    },
    [setApiKey],
  )

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">{t('settings.page.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.page.description')}
          </p>
        </div>

        <Tabs defaultValue="general">
          <TabsList className="mb-4">
            <TabsTrigger value="general">{t('settings.page.tabs.general')}</TabsTrigger>
            <TabsTrigger value="api">{t('settings.page.tabs.api')}</TabsTrigger>
            <TabsTrigger value="tokens">{t('settings.page.tabs.tokens')}</TabsTrigger>
            <TabsTrigger value="gateway">{t('settings.page.tabs.gateway')}</TabsTrigger>
            <TabsTrigger value="security">{t('settings.page.tabs.security')}</TabsTrigger>
            <TabsTrigger value="subscription">{t('settings.page.tabs.subscription')}</TabsTrigger>
            <TabsTrigger value="about">{t('settings.page.tabs.about')}</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.page.general.appearance.title')}</CardTitle>
                <CardDescription>{t('settings.page.general.appearance.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('settings.page.general.appearance.theme')}</Label>
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
                <CardTitle>{t('settings.page.general.startup.title')}</CardTitle>
                <CardDescription>{t('settings.page.general.startup.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.page.general.startup.autoStartGateway')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.page.general.startup.autoStartGatewayHint')}
                    </p>
                  </div>
                  <Switch
                    checked={autoStartGateway}
                    onCheckedChange={setAutoStartGateway}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('settings.page.general.startup.autoCheckUpdates')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.page.general.startup.autoCheckUpdatesHint')}
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

          {/* Tokens Tab */}
          <TabsContent value="tokens">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.page.tokens.title')}</CardTitle>
                <CardDescription>
                  {t('settings.page.tokens.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {secretsError ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {secretsError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="discord-bot-token">{t('settings.page.tokens.fields.discordBotToken')}</Label>
                  <Input
                    id="discord-bot-token"
                    type="password"
                    value={discordBotToken}
                    onChange={(e) => setSecretValue('discordBotToken', e.target.value)}
                    placeholder="..."
                    disabled={secretsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discord-app-token">{t('settings.page.tokens.fields.discordAppToken')}</Label>
                  <Input
                    id="discord-app-token"
                    type="password"
                    value={discordAppToken}
                    onChange={(e) => setSecretValue('discordAppToken', e.target.value)}
                    placeholder="..."
                    disabled={secretsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram-bot-token">{t('settings.page.tokens.fields.telegramBotToken')}</Label>
                  <Input
                    id="telegram-bot-token"
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setSecretValue('telegramBotToken', e.target.value)}
                    placeholder="..."
                    disabled={secretsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slack-bot-token">{t('settings.page.tokens.fields.slackBotToken')}</Label>
                  <Input
                    id="slack-bot-token"
                    type="password"
                    value={slackBotToken}
                    onChange={(e) => setSecretValue('slackBotToken', e.target.value)}
                    placeholder="..."
                    disabled={secretsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slack-app-token">{t('settings.page.tokens.fields.slackAppToken')}</Label>
                  <Input
                    id="slack-app-token"
                    type="password"
                    value={slackAppToken}
                    onChange={(e) => setSecretValue('slackAppToken', e.target.value)}
                    placeholder="..."
                    disabled={secretsLoading}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={saveSecrets} disabled={secretsSaving || secretsLoading}>
                    {secretsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('actions.save')}
                  </Button>
                  {secretsSaveSuccess ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {t('settings.page.tokens.saved')}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models & Auth Tab */}
          <TabsContent value="api">
            {modelsLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading models status...</span>
                </CardContent>
              </Card>
            ) : modelsStatus ? (
              <div className="space-y-4">
                <ModelConfig
                  defaultModel={modelsStatus.defaultModel}
                  fallbacks={modelsStatus.fallbacks}
                />
                {modelsStatus.auth.providers.map((p) => (
                  <ProviderCard
                    key={p.provider}
                    provider={p.provider}
                    authInfo={p}
                    oauthStatus={findOAuthStatus(modelsStatus, p.provider)}
                    apiKeyValue={apiKeys[mapProviderToKey(p.provider)]}
                    onApiKeyChange={handleApiKeyChange(p.provider)}
                    onApiKeySave={saveApiKeys}
                    isSaving={isSaving}
                    saveSuccess={saveSuccess}
                  />
                ))}
              </div>
            ) : (
              /* Fallback: old manual input UI when openclaw CLI is unavailable */
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
            )}
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={gatewayServiceBusy}
                    onClick={() => {
                      setGatewayServiceBusy(true)
                      setGatewayServiceMessage(null)
                      ipc.gateway
                        .installService()
                        .then(() => setGatewayServiceMessage('Gateway service installed'))
                        .catch((e) => setGatewayServiceMessage(e instanceof Error ? e.message : 'Install failed'))
                        .finally(() => setGatewayServiceBusy(false))
                    }}
                  >
                    Install Service
                  </Button>
                  <Button
                    variant="outline"
                    disabled={gatewayServiceBusy}
                    onClick={() => {
                      setGatewayServiceBusy(true)
                      setGatewayServiceMessage(null)
                      ipc.gateway
                        .restartService()
                        .then(() => setGatewayServiceMessage('Gateway service restarted'))
                        .catch((e) => setGatewayServiceMessage(e instanceof Error ? e.message : 'Restart failed'))
                        .finally(() => setGatewayServiceBusy(false))
                    }}
                  >
                    Restart Service
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={gatewayServiceBusy}
                    onClick={() => {
                      setGatewayServiceBusy(true)
                      setGatewayServiceMessage(null)
                      ipc.gateway
                        .uninstallService()
                        .then(() => setGatewayServiceMessage('Gateway service uninstalled'))
                        .catch((e) => setGatewayServiceMessage(e instanceof Error ? e.message : 'Uninstall failed'))
                        .finally(() => setGatewayServiceBusy(false))
                    }}
                  >
                    Uninstall Service
                  </Button>
                </div>

                {gatewayServiceMessage ? (
                  <div className="text-sm text-muted-foreground">{gatewayServiceMessage}</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Restricted controls that only touch OpenClaw permissions (minmax). These changes are applied via allowlisted `openclaw config set` paths.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {securityMessage ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {securityMessage}
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Elevated (WebChat)</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable elevated tools from webchat (use with care)
                    </p>
                  </div>
                  <Switch
                    checked={allowElevatedWebchat}
                    onCheckedChange={setAllowElevatedWebchat}
                    disabled={securityLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Elevated (Discord)</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable elevated tools from Discord (use with care)
                    </p>
                  </div>
                  <Switch
                    checked={allowElevatedDiscord}
                    onCheckedChange={setAllowElevatedDiscord}
                    disabled={securityLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sandbox Mode</Label>
                  <Select
                    value={sandboxMode}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setSandboxMode(e.target.value)}
                    disabled={securityLoading}
                  >
                    <option value="off">off</option>
                    <option value="docker">docker</option>
                    <option value="native">native</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Workspace Access</Label>
                  <Select
                    value={workspaceAccess}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setWorkspaceAccess(e.target.value)}
                    disabled={securityLoading}
                  >
                    <option value="none">none</option>
                    <option value="ro">ro</option>
                    <option value="rw">rw</option>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    disabled={securityLoading}
                    onClick={() => {
                      setSecurityLoading(true)
                      setSecurityMessage(null)
                      ipc.security
                        .apply([
                          { path: 'tools.elevated.allowFrom.webchat', value: allowElevatedWebchat },
                          { path: 'tools.elevated.allowFrom.discord', value: allowElevatedDiscord },
                          { path: 'agents.defaults.sandbox.mode', value: sandboxMode },
                          { path: 'agents.defaults.sandbox.workspaceAccess', value: workspaceAccess },
                        ])
                        .then(() => setSecurityMessage('Security settings updated'))
                        .catch((e) => setSecurityMessage(e instanceof Error ? e.message : 'Apply failed'))
                        .finally(() => setSecurityLoading(false))
                    }}
                  >
                    Apply
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
