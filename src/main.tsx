import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import App from './App'
import './locales/i18n'
import 'katex/dist/katex.min.css'
import './index.css'

// Routes
import ChatPage from './routes/page'
import ChannelsPage from './routes/channels/page'
import ToolsPage from './routes/tools/page'
import MCPPage from './routes/mcp/page'
import PluginsPage from './routes/plugins/page'
import SchedulerPage from './routes/scheduler/page'
import UsagePage from './routes/usage/page'
import SettingsPage from './routes/settings/page'
import OnboardingPage from './routes/onboarding/page'

const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: 'channels', element: <ChannelsPage /> },
      { path: 'tools', element: <ToolsPage /> },
      { path: 'mcp', element: <MCPPage /> },
      { path: 'plugins', element: <PluginsPage /> },
      { path: 'scheduler', element: <SchedulerPage /> },
      { path: 'usage', element: <UsagePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
