import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@clawui/ui'
import { AlertCircle, CheckCircle2, Download, Loader2, X } from 'lucide-react'
import type { InstallProgress, RuntimeStatus } from '@/lib/ipc'

interface InstallStepProps {
  runtimeStatus: RuntimeStatus | null
  installProgress: InstallProgress | null
  isInstalling: boolean
  error: string | null
  onInstall: () => void
  onSkip?: () => void
}

export function InstallStep({
  runtimeStatus,
  installProgress,
  isInstalling,
  error,
  onInstall,
  onSkip,
}: InstallStepProps) {
  const getStageIcon = (stage: InstallProgress['stage']) => {
    if (stage === 'complete') return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (stage === 'error') return <X className="h-5 w-5 text-destructive" />
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Install OpenClaw Runtime</CardTitle>
          <CardDescription>
            OpenClaw requires Node.js 22+ to run. We'll install everything you need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current status */}
          {runtimeStatus && (
            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Node.js</span>
                <span className={runtimeStatus.nodeInstalled ? 'text-green-500' : 'text-amber-500'}>
                  {runtimeStatus.nodeInstalled
                    ? `v${runtimeStatus.nodeVersion}`
                    : 'Not installed'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>OpenClaw</span>
                <span className={runtimeStatus.openclawInstalled ? 'text-green-500' : 'text-amber-500'}>
                  {runtimeStatus.openclawInstalled
                    ? `v${runtimeStatus.openclawVersion}`
                    : 'Not installed'}
                </span>
              </div>
            </div>
          )}

          {/* Install progress */}
          {installProgress && isInstalling && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getStageIcon(installProgress.stage)}
                <span className="text-sm">{installProgress.message}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${installProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={onInstall}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Install Now
                </>
              )}
            </Button>
            {onSkip && !isInstalling && (
              <Button variant="outline" onClick={onSkip}>
                Skip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
