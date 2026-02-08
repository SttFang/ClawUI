import { useNavigate } from 'react-router-dom'
import {
  useOnboardingStore,
  selectOnboardingStep,
  selectRuntimeStatus,
  selectInstallProgress,
  selectIsLoading,
  selectError,
} from '@/store/onboarding'
import {
  LoginStep,
  DetectingStep,
  InstallStep,
  ConfigModeStep,
  BYOKStep,
  CompleteStep,
} from './steps'

// Draggable title bar for frameless window
function DraggableTitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-11 z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    />
  )
}

export function Onboarding() {
  const navigate = useNavigate()

  const step = useOnboardingStore(selectOnboardingStep)
  const runtimeStatus = useOnboardingStore(selectRuntimeStatus)
  const installProgress = useOnboardingStore(selectInstallProgress)
  const isLoading = useOnboardingStore(selectIsLoading)
  const error = useOnboardingStore(selectError)

  const detectRuntime = useOnboardingStore((s) => s.detectRuntime)
  const startInstall = useOnboardingStore((s) => s.startInstall)
  const setStep = useOnboardingStore((s) => s.setStep)
  const configureBYOK = useOnboardingStore((s) => s.configureBYOK)
  const validateApiKey = useOnboardingStore((s) => s.validateApiKey)

  // Skip auth for now and detect runtime on login
  const handleLogin = () => {
    detectRuntime()
  }

  const handleInstall = () => {
    startInstall()
  }

  const handleComplete = () => {
    navigate('/')
  }

  const renderStep = () => {
    switch (step) {
      case 'login':
        return (
          <LoginStep
            onLogin={handleLogin}
            onGithubLogin={handleLogin}
            onGoogleLogin={handleLogin}
          />
        )

      case 'detecting':
        return <DetectingStep />

      case 'install-required':
      case 'installing':
        return (
          <InstallStep
            runtimeStatus={runtimeStatus}
            installProgress={installProgress}
            isInstalling={step === 'installing'}
            error={error}
            onInstall={handleInstall}
          />
        )

      case 'config-mode':
        return (
          <ConfigModeStep
            onSubscription={() => setStep('config-subscription')}
            onBYOK={() => setStep('config-byok')}
          />
        )

      case 'config-subscription':
        // TODO: Implement subscription flow
        return (
          <ConfigModeStep
            onSubscription={() => setStep('config-subscription')}
            onBYOK={() => setStep('config-byok')}
          />
        )

      case 'config-byok':
        return (
          <BYOKStep
            isLoading={isLoading}
            error={error}
            onConfigure={configureBYOK}
            onValidateKey={validateApiKey}
            onBack={() => setStep('config-mode')}
          />
        )

      case 'complete':
        return <CompleteStep onComplete={handleComplete} />

      default:
        return <LoginStep onLogin={handleLogin} />
    }
  }

  return (
    <>
      <DraggableTitleBar />
      {renderStep()}
    </>
  )
}

export default Onboarding
