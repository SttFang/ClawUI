import { NavLink } from 'react-router-dom'
import {
  MessageSquare,
  Radio,
  Wrench,
  Server,
  Puzzle,
  Clock,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGatewayStore } from '@/store/gateway'

const navItems = [
  { to: '/', icon: MessageSquare, label: 'Chat' },
  { to: '/channels', icon: Radio, label: 'Channels' },
  { to: '/tools', icon: Wrench, label: 'Tools' },
  { to: '/mcp', icon: Server, label: 'MCP' },
  { to: '/plugins', icon: Puzzle, label: 'Plugins' },
  { to: '/scheduler', icon: Clock, label: 'Scheduler' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function NavRail() {
  const status = useGatewayStore((s) => s.status)

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center bg-sidebar pb-3 pt-10">
      {/* Logo */}
      <div className="mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <span className="text-base font-bold text-primary-foreground">C</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground'
              )
            }
            title={item.label}
          >
            <item.icon size={18} />
          </NavLink>
        ))}
      </nav>

      {/* Gateway Status */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <div
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            status === 'running' && 'bg-green-500',
            status === 'starting' && 'animate-pulse bg-yellow-500',
            status === 'stopped' && 'bg-gray-400',
            status === 'error' && 'bg-red-500'
          )}
          title={`Gateway: ${status}`}
        />
      </div>
    </aside>
  )
}
