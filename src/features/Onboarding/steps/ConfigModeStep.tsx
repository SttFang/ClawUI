import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@clawui/ui'
import { CreditCard, Key } from 'lucide-react'

interface ConfigModeStepProps {
  onSubscription: () => void
  onBYOK: () => void
}

export function ConfigModeStep({ onSubscription, onBYOK }: ConfigModeStepProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose Configuration Mode</CardTitle>
          <CardDescription>
            How would you like to configure your AI models?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            onClick={onSubscription}
            className="group w-full rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">One-Click Setup (Subscription)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use our managed AI proxy service. No API keys needed. Pay as you go
                  with simple pricing.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onBYOK}
            className="group w-full rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-muted p-2">
                <Key className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Bring Your Own Keys (BYOK)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use your own API keys from Anthropic, OpenAI, or other providers.
                  Full control over your usage and billing.
                </p>
              </div>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
