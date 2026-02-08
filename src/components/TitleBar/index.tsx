import { useTranslation } from 'react-i18next'
import { PanelLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { IconActionButton } from '@/components/IconActionButton'

export interface TitleBarProps {
  onToggleSidebar?: () => void
  onBack?: () => void
  onForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

/**
 * TitleBar - 应用顶边栏
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢 (原生)  [☰] [←] [→]                                          │
 * │ (70px 留空)    (navigation)                                          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 整个栏为拖动区域，按钮使用 titlebar-no-drag
 * 左侧留 70px 空间给原生红绿灯
 */
export function TitleBar({
  onToggleSidebar,
  onBack,
  onForward,
  canGoBack = false,
  canGoForward = false,
}: TitleBarProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className="titlebar flex h-11 w-full shrink-0 items-center border-b border-border bg-sidebar px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Space for native traffic lights + Navigation */}
      <div className="flex items-center">
        {/* 为原生红绿灯留出空间 (约 70px) */}
        <div className="w-[70px] shrink-0" />

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
    </div>
  )
}
