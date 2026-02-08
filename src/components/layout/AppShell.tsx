import type { ReactNode } from 'react'
import { NavRail } from './NavRail'
import { TitleBar } from './TitleBar'

interface AppShellProps {
  children: ReactNode
}

/**
 * 应用顶级布局 Shell
 *
 * 布局结构：
 * ┌──────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢 │ [☰] [←] [→]  [Chat][Cowork][Code]     [👤] │
 * │ NavRail├────────────────────────────────────────────┤
 * │  56px  │                                            │
 * │        │              Main Content                  │
 * │        │                                            │
 * └────────┴────────────────────────────────────────────┘
 *
 * NavRail pt-10 (40px) 为红绿灯留空间
 * TitleBar h-11 (44px) 包含导航、模式切换、用户头像
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Navigation Rail */}
      <NavRail />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Title Bar with navigation and mode tabs */}
        <TitleBar />

        {/* Page Content */}
        <main className="relative flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
