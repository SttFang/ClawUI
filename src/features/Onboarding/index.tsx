import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import {
  useOnboardingStore,
  selectOnboardingStep,
  selectRuntimeStatus,
  selectInstallProgress,
  selectError,
} from '@/store/onboarding'
import { Button, Progress } from '@clawui/ui'

// Draggable title bar for frameless window
function DraggableTitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-11 z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    />
  )
}

// Stage labels for user-friendly display
const stageLabels: Record<string, string> = {
  'idle': 'Preparing...',
  'checking-requirements': 'Checking Node.js/npm...',
  'installing-openclaw': 'Installing OpenClaw...',
  'verifying': 'Verifying installation...',
  'complete': 'Installation complete!',
  'error': 'Installation failed',
}

export function Onboarding() {
  const navigate = useNavigate()

  const step = useOnboardingStore(selectOnboardingStep)
  const runtimeStatus = useOnboardingStore(selectRuntimeStatus)
  const installProgress = useOnboardingStore(selectInstallProgress)
  const error = useOnboardingStore(selectError)

  const detectRuntime = useOnboardingStore((s) => s.detectRuntime)
  const startInstall = useOnboardingStore((s) => s.startInstall)
  const reset = useOnboardingStore((s) => s.reset)

  // Auto-detect runtime on mount
  useEffect(() => {
    detectRuntime()
  }, [detectRuntime])

  // Navigate to chat when complete
  useEffect(() => {
    if (step === 'complete') {
      // Small delay for user to see completion
      const timer = setTimeout(() => {
        navigate('/', { replace: true })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [step, navigate])

  const handleInstall = () => {
    startInstall()
  }

  const handleRetry = () => {
    reset()
    detectRuntime()
  }

  return (
    <>
      <DraggableTitleBar />
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          {/* Logo/Title */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">ClawUI</h1>
            <p className="text-muted-foreground">OpenClaw Desktop Client</p>
          </div>

          {/* Step Content */}
          <div className="space-y-6">
            {step === 'checking' && (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Checking environment...</p>
              </div>
            )}

            {step === 'install' && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <Download className="h-12 w-12 mx-auto text-primary" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Install OpenClaw</h2>
                    <p className="text-sm text-muted-foreground">
                      OpenClaw is not installed on your system.
                      Click below to install it automatically.
                    </p>
                  </div>
                  {runtimeStatus && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Node.js: {runtimeStatus.nodeInstalled ? '✓ ' + runtimeStatus.nodeVersion : '✗ Not found'}</p>
                      <p>OpenClaw: {runtimeStatus.openclawInstalled ? '✓ ' + runtimeStatus.openclawVersion : '✗ Not found'}</p>
                    </div>
                  )}
                </div>
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  One-Click Install
                </Button>
              </div>
            )}

            {step === 'installing' && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Installing...</h2>
                    <p className="text-sm text-muted-foreground">
                      {installProgress ? stageLabels[installProgress.stage] : 'Starting installation...'}
                    </p>
                  </div>
                  {installProgress && (
                    <div className="space-y-2">
                      <Progress value={installProgress.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {installProgress.progress}% complete
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'complete' && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Ready to Go!</h2>
                    <p className="text-sm text-muted-foreground">
                      OpenClaw is installed. Redirecting to chat...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="space-y-6">
                <div className="p-6 rounded-lg bg-card border space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">Installation Failed</h2>
                    <p className="text-sm text-destructive">
                      {error || 'An unexpected error occurred'}
                    </p>
                  </div>
                </div>
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Onboarding
