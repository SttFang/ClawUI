import type { ReactNode } from 'react'
import { NavRail } from './NavRail'

interface AppShellProps {
  children: ReactNode
}

/**
 * 应用顶级布局 Shell
 *
 * 布局结构（参考 CodePilot）：
 * ┌──────────────────────────────────┐
 * │ 🔴🟡🟢 │  (drag region)          │
 * │ NavRail├────────────────────────┤
 * │  56px  │                        │
 * │        │      Main Content      │
 * │        │                        │
 * └────────┴────────────────────────┘
 *
 * NavRail pt-10 (40px) 为红绿灯留空间
 * 主内容区 h-11 (44px) 为拖动区域
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Navigation Rail */}
      <NavRail />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Electron draggable title bar region - 纯拖动区域，无内容 */}
        <div
          className="h-11 w-full shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />

        {/* Page Content */}
        <main className="relative flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
