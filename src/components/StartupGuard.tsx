import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ipc, RuntimeStatus } from '@/lib/ipc'
import { Loader2 } from 'lucide-react'
import { useGatewayStore, selectGatewayStatus } from '@/store/gateway'
import { useChatStore } from '@/store/chat'

interface StartupGuardProps {
  children: React.ReactNode
}

export interface StartupState {
  isChecking: boolean
  openclawInstalled: boolean
  configValid: boolean
  runtimeStatus: RuntimeStatus | null
}

/**
 * StartupGuard checks if OpenClaw is installed on startup.
 * - If NOT installed → redirect to /onboarding for installation
 * - If installed → start Gateway, connect WebSocket, allow access to main app
 */
export function StartupGuard({ children }: StartupGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<StartupState>({
    isChecking: true,
    openclawInstalled: false,
    configValid: false,
    runtimeStatus: null,
  })

  // Track if WebSocket connection has been attempted to prevent duplicate calls
  const wsConnectionAttempted = useRef(false)

  useEffect(() => {
    // Skip check if already on onboarding page
    if (location.pathname === '/onboarding') {
      setState((prev) => ({ ...prev, isChecking: false }))
      return
    }

    async function checkOpenClaw() {
      try {
        console.log('[StartupGuard] Starting OpenClaw detection...')
        const status = await ipc.onboarding.detect()
        console.log('[StartupGuard] Detection result:', status)

        if (!status) {
          // Can't detect - go to onboarding
          console.log('[StartupGuard] No status returned, redirecting to onboarding')
          navigate('/onboarding', { replace: true })
          return
        }

        setState({
          isChecking: false,
          openclawInstalled: status.openclawInstalled,
          configValid: status.configValid,
          runtimeStatus: status,
        })

        // Only redirect if OpenClaw is NOT installed
        // Config check is done in ChatPage with a banner prompt
        if (!status.openclawInstalled) {
          console.log('[StartupGuard] OpenClaw not installed, redirecting to onboarding')
          navigate('/onboarding', { replace: true })
        } else {
          // OpenClaw is installed - start Gateway
          console.log('[StartupGuard] OpenClaw installed, starting Gateway')
          const gatewayStore = useGatewayStore.getState()
          if (gatewayStore.status === 'stopped') {
            gatewayStore.start()
          }
        }
      } catch (error) {
        console.error('[StartupGuard] Failed to check OpenClaw:', error)
        // On error, go to onboarding to let user install
        navigate('/onboarding', { replace: true })
      }
    }

    checkOpenClaw()
  }, [navigate, location.pathname])

  // Subscribe to Gateway status changes to connect WebSocket when running
  // Use the stable selector function to prevent infinite re-renders
  const gatewayStatus = useGatewayStore(selectGatewayStatus)

  useEffect(() => {
    // Only connect once when gateway becomes running and OpenClaw is installed
    if (gatewayStatus === 'running' && state.openclawInstalled && !wsConnectionAttempted.current) {
      wsConnectionAttempted.current = true
      // Add a small delay to ensure Gateway is fully ready to accept connections
      const timer = setTimeout(() => {
        console.log('[StartupGuard] Gateway running, connecting WebSocket...')
        useChatStore.getState().connectWebSocket()
      }, 500)
      return () => clearTimeout(timer)
    }

    // Reset the flag if gateway stops so we can reconnect later
    if (gatewayStatus === 'stopped') {
      wsConnectionAttempted.current = false
    }
  }, [gatewayStatus, state.openclawInstalled])

  if (state.isChecking) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking OpenClaw installation...</p>
        </div>
      </div>
    )
  }

  if (!state.openclawInstalled && location.pathname !== '/onboarding') {
    return null // Will redirect
  }

  return <>{children}</>
}
