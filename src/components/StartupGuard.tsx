import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ipc } from '@/lib/ipc'
import { Loader2 } from 'lucide-react'

interface StartupGuardProps {
  children: React.ReactNode
}

/**
 * StartupGuard checks if the app is properly configured on startup.
 * If not configured, it redirects to the onboarding flow.
 */
export function StartupGuard({ children }: StartupGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)

  useEffect(() => {
    // Skip check if already on onboarding page
    if (location.pathname === '/onboarding') {
      setIsChecking(false)
      setIsConfigured(true)
      return
    }

    async function checkConfiguration() {
      try {
        const status = await ipc.onboarding.detect()

        if (!status) {
          // Can't detect - go to onboarding
          navigate('/onboarding', { replace: true })
          return
        }

        // Check if properly configured
        if (status.configValid && status.openclawInstalled) {
          setIsConfigured(true)
        } else {
          // Not configured - go to onboarding
          navigate('/onboarding', { replace: true })
        }
      } catch (error) {
        console.error('Failed to check configuration:', error)
        // On error, go to onboarding to let user configure
        navigate('/onboarding', { replace: true })
      } finally {
        setIsChecking(false)
      }
    }

    checkConfiguration()
  }, [navigate, location.pathname])

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking configuration...</p>
        </div>
      </div>
    )
  }

  if (!isConfigured && location.pathname !== '/onboarding') {
    return null // Will redirect
  }

  return <>{children}</>
}
