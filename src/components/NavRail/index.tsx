import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Radio,
  Wrench,
  Server,
  Puzzle,
  Clock,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
const navItems = [
  { to: '/', icon: MessageSquare, labelKey: 'nav:chat' },
  { to: '/channels', icon: Radio, labelKey: 'nav:channels' },
  { to: '/tools', icon: Wrench, labelKey: 'nav:tools' },
  { to: '/mcp', icon: Server, labelKey: 'nav:mcp' },
  { to: '/plugins', icon: Puzzle, labelKey: 'nav:plugins' },
  { to: '/scheduler', icon: Clock, labelKey: 'nav:scheduler' },
  { to: '/usage', icon: BarChart3, labelKey: 'nav:usage' },
  { to: '/settings', icon: Settings, labelKey: 'nav:settings' },
]

export function NavRail() {
  const { t } = useTranslation()

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center bg-sidebar pb-3 pt-3">
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
            title={t(item.labelKey)}
          >
            <item.icon size={18} />
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
