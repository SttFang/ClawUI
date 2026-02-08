import { useNavigate } from 'react-router-dom'
import { AlertCircle, Key, Settings, X } from 'lucide-react'
import { Button, Alert, AlertDescription, AlertTitle } from '@clawui/ui'

interface ConfigBannerProps {
  onDismiss?: () => void
}

/**
 * Banner shown in ChatPage when API keys are not configured.
 * Offers two options:
 * - One-click config (login) - not yet implemented
 * - Manual config (settings page)
 */
export function ConfigBanner({ onDismiss }: ConfigBannerProps) {
  const navigate = useNavigate()

  const handleOneClickConfig = () => {
    // TODO: Implement one-click config with login
    // For now, redirect to settings
    navigate('/settings')
  }

  const handleManualConfig = () => {
    navigate('/settings')
  }

  return (
    <Alert className="mb-4 border-warning bg-warning/10">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>API Key Not Configured</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-accent rounded-sm transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">
          To start chatting, you need to configure your API keys for AI providers (Anthropic, OpenAI, etc.).
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleOneClickConfig}>
            <Key className="mr-2 h-3 w-3" />
            One-Click Config
          </Button>
          <Button size="sm" variant="outline" onClick={handleManualConfig}>
            <Settings className="mr-2 h-3 w-3" />
            Manual Config
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
