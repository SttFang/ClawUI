import { useState } from 'react'
import { PanelLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { IconActionButton } from '@/components/ui/icon-action-button'
import { TabSwitcher, type TabSwitcherOption } from '@/components/ui/tab-switcher'
import { UserAvatar } from '@/components/ui/user-avatar'

const MODE_OPTIONS: TabSwitcherOption[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'cowork', label: 'Cowork' },
  { value: 'code', label: 'Code' },
]

export interface TitleBarProps {
  onToggleSidebar?: () => void
  onBack?: () => void
  onForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

/**
 * TitleBar - Main application title bar
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────┐
 * │ [Sidebar] [←] [→]  │   [Chat] [Cowork] [Code]   │  [👤] │
 * │   (navigation)     │      (mode tabs)           │(avatar)│
 * └──────────────────────────────────────────────────────────┘
 *
 * The entire bar is a drag region, with buttons using titlebar-no-drag
 */
export function TitleBar({
  onToggleSidebar,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
}: TitleBarProps) {
  const [mode, setMode] = useState('chat')

  return (
    <div
      className="titlebar flex h-11 w-full shrink-0 items-center justify-between px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Navigation controls */}
      <div className="flex items-center gap-1">
        <IconActionButton
          icon={<PanelLeft size={16} />}
          onClick={onToggleSidebar}
          title="Toggle sidebar"
        />
        <IconActionButton
          icon={<ChevronLeft size={16} />}
          onClick={onBack}
          disabled={!canGoBack}
          title="Go back"
        />
        <IconActionButton
          icon={<ChevronRight size={16} />}
          onClick={onForward}
          disabled={!canGoForward}
          title="Go forward"
        />
      </div>

      {/* Center: Mode tabs */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <TabSwitcher options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </div>

      {/* Right: User avatar */}
      <div className="flex items-center">
        <UserAvatar size="sm" title="User profile" />
      </div>
    </div>
  )
}
