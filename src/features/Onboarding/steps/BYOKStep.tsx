import { useState } from 'react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@clawui/ui'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

interface BYOKStepProps {
  isLoading: boolean
  error: string | null
  onConfigure: (anthropicKey?: string, openaiKey?: string) => Promise<void>
  onValidateKey: (provider: 'anthropic' | 'openai', key: string) => Promise<boolean>
  onBack: () => void
}

export function BYOKStep({
  isLoading,
  error,
  onConfigure,
  onValidateKey,
  onBack,
}: BYOKStepProps) {
  const [anthropicKey, setAnthropicKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicValid, setAnthropicValid] = useState<boolean | null>(null)
  const [openaiValid, setOpenaiValid] = useState<boolean | null>(null)

  const handleAnthropicBlur = async () => {
    if (anthropicKey) {
      const valid = await onValidateKey('anthropic', anthropicKey)
      setAnthropicValid(valid)
    } else {
      setAnthropicValid(null)
    }
  }

  const handleOpenaiBlur = async () => {
    if (openaiKey) {
      const valid = await onValidateKey('openai', openaiKey)
      setOpenaiValid(valid)
    } else {
      setOpenaiValid(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anthropicKey && !openaiKey) return
    await onConfigure(anthropicKey || undefined, openaiKey || undefined)
  }

  const hasValidKey = (anthropicKey && anthropicValid !== false) || (openaiKey && openaiValid !== false)

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 w-fit"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <CardTitle className="text-xl">Configure API Keys</CardTitle>
          <CardDescription>
            Enter at least one API key to get started. Your keys are stored locally
            and never sent to our servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="anthropic">Anthropic API Key</Label>
              <div className="relative">
                <Input
                  id="anthropic"
                  type="password"
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  onBlur={handleAnthropicBlur}
                />
                {anthropicValid !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {anthropicValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai">OpenAI API Key</Label>
              <div className="relative">
                <Input
                  id="openai"
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  onBlur={handleOpenaiBlur}
                />
                {openaiValid !== null && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {openaiValid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from{' '}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com
                </a>
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !hasValidKey}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configuring...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
