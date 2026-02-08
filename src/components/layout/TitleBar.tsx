import { useTranslation } from 'react-i18next'
import { PanelLeft, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { IconActionButton } from '@/components/ui/icon-action-button'
import { UserAvatar } from '@/components/ui/user-avatar'
import { TrafficLights } from './TrafficLights'

export interface TitleBarProps {
  onToggleSidebar?: () => void
  onBack?: () => void
  onForward?: () => void
  onNewSession?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

/**
 * TitleBar - 应用顶边栏
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢  [☰] [←] [→]                        [+ 新建会话]       [👤] │
 * │ (traffic)(navigation)                      (action)          (avatar)│
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 整个栏为拖动区域，按钮使用 titlebar-no-drag
 */
export function TitleBar({
  onToggleSidebar,
  onBack,
  onForward,
  onNewSession,
  canGoBack = false,
  canGoForward = false,
}: TitleBarProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className="titlebar flex h-11 w-full shrink-0 items-center justify-between gap-4 px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Traffic lights + Navigation */}
      <div className="flex items-center gap-3">
        <TrafficLights />

        <div className="flex items-center gap-1">
          <IconActionButton
            icon={<PanelLeft size={16} />}
            onClick={onToggleSidebar}
            title={t('navigation.toggleSidebar')}
          />
          <IconActionButton
            icon={<ChevronLeft size={16} />}
            onClick={onBack}
            disabled={!canGoBack}
            title={t('navigation.goBack')}
          />
          <IconActionButton
            icon={<ChevronRight size={16} />}
            onClick={onForward}
            disabled={!canGoForward}
            title={t('navigation.goForward')}
          />
        </div>
      </div>

      {/* Right: New Session + Avatar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNewSession}
          className="titlebar-no-drag inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={14} />
          {t('actions.newSession')}
        </button>

        <UserAvatar size="sm" title="User profile" />
      </div>
    </div>
  )
}
