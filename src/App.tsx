import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { StartupGuard } from '@/components/StartupGuard'
import { useGatewayStore, initGatewayIpcListener } from '@/store/gateway'
import { useChatStore, initChatStreamListener } from '@/store/chat'
import { initTheme } from '@/store/ui'
import { useEffect } from 'react'

// Initialize IPC listeners and theme once
initGatewayIpcListener()
initChatStreamListener()
initTheme()

function App() {
  const { status, start } = useGatewayStore()
  const { connectWebSocket } = useChatStore()

  useEffect(() => {
    // Auto-start gateway on app launch
    if (status === 'stopped') {
      start()
    }
  }, [])

  useEffect(() => {
    // Auto-connect WebSocket when gateway is running
    if (status === 'running') {
      connectWebSocket()
    }
  }, [status, connectWebSocket])

  return (
    <StartupGuard>
      <AppShell>
        <Outlet />
      </AppShell>
    </StartupGuard>
  )
}

export default App
