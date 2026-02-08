import { Outlet } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { useGatewayStore, initGatewayIpcListener } from '@/store/gateway'
import { useEffect } from 'react'

// Initialize IPC listener once
initGatewayIpcListener()

function App() {
  const { status, start } = useGatewayStore()

  useEffect(() => {
    // Auto-start gateway on app launch
    if (status === 'stopped') {
      start()
    }
  }, [])

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export default App
