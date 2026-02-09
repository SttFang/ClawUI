import { type ComponentType, useState } from 'react'
import { Card, CardContent, Button, Input } from '@clawui/ui'
import { CheckCircle2, Loader2, Clock, Edit3, Eye, EyeOff } from 'lucide-react'
import Anthropic from '@lobehub/icons/es/Anthropic'
import OpenAI from '@lobehub/icons/es/OpenAI'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import type { ProviderAuthInfo, OAuthProviderStatus } from '@clawui/types/models'

const PROVIDER_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  anthropic: Anthropic,
  openai: OpenAI,
  'openai-codex': OpenAI,
  openrouter: OpenRouter,
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'openai-codex': 'OpenAI Codex',
  openrouter: 'OpenRouter',
}

function getAuthStatus(authInfo: ProviderAuthInfo, oauthStatus?: OAuthProviderStatus) {
  const { effective } = authInfo

  if (effective.kind === 'env' && effective.detail) {
    return { color: 'text-green-500', bg: 'bg-green-500', label: 'OK' } as const
  }
  if (effective.kind === 'profiles') {
    if (oauthStatus?.status === 'ok') {
      return { color: 'text-green-500', bg: 'bg-green-500', label: 'OK' } as const
    }
    if (oauthStatus?.status === 'expired') {
      return { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Expired' } as const
    }
  }
  if (effective.kind === 'token' && effective.detail) {
    return { color: 'text-green-500', bg: 'bg-green-500', label: 'OK' } as const
  }
  return { color: 'text-red-500', bg: 'bg-red-500', label: 'Missing' } as const
}

function getAuthDescription(authInfo: ProviderAuthInfo, oauthStatus?: OAuthProviderStatus): string {
  const { effective } = authInfo

  if (effective.kind === 'env') {
    return effective.detail ? `env var  ${effective.detail}` : 'env var (not set)'
  }
  if (effective.kind === 'profiles') {
    const profile = oauthStatus?.profiles?.[0]
    if (profile?.expiresAt) {
      const date = new Date(profile.expiresAt)
      return `OAuth   expires ${date.toLocaleDateString()}`
    }
    return 'OAuth'
  }
  if (effective.kind === 'token') {
    return effective.detail ? `token  ${effective.detail}` : 'token'
  }
  return 'not configured'
}

interface ProviderCardProps {
  provider: string
  authInfo: ProviderAuthInfo
  oauthStatus?: OAuthProviderStatus
  apiKeyValue: string
  onApiKeyChange: (value: string) => void
  onApiKeySave: () => void
  isSaving: boolean
  saveSuccess: boolean
}

export function ProviderCard({
  provider,
  authInfo,
  oauthStatus,
  apiKeyValue,
  onApiKeyChange,
  onApiKeySave,
  isSaving,
  saveSuccess,
}: ProviderCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const Icon = PROVIDER_ICONS[provider]
  const label = PROVIDER_LABELS[provider] ?? provider
  const status = getAuthStatus(authInfo, oauthStatus)
  const authDesc = getAuthDescription(authInfo, oauthStatus)
  const isEnvAuth = authInfo.effective.kind === 'env' || authInfo.effective.kind === 'none'
  const isOAuthAuth = authInfo.effective.kind === 'profiles'
  const isMissing = status.label === 'Missing'

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header: icon + name + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon ? (
              <Icon size={20} />
            ) : (
              <div className="w-5 h-5 rounded bg-muted" />
            )}
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${status.bg}`} />
            <span className={`text-sm ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {/* Auth description */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {status.label === 'Expired' ? (
            <Clock className="h-3.5 w-3.5" />
          ) : (
            <span className="text-xs">Auth:</span>
          )}
          <span className="font-mono text-xs">{authDesc}</span>
        </div>

        {/* OAuth provider: show refresh button */}
        {isOAuthAuth && (
          <Button variant="outline" size="sm" disabled>
            Refresh OAuth
          </Button>
        )}

        {/* Env/none auth: show API key editor */}
        {isEnvAuth && (
          <div className="space-y-2">
            {isMissing || isEditing ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={`Enter ${label} API key...`}
                    value={apiKeyValue}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onApiKeySave()
                    setIsEditing(false)
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
                {!isMissing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Key
              </Button>
            )}
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
