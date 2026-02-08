import type { ReactNode } from 'react'
import { NavRail } from './NavRail'
import { TitleBar } from './TitleBar'

interface AppShellProps {
  children: ReactNode
}

/**
 * 应用顶级布局 Shell
 *
 * 布局结构（红绿灯与顶边栏对齐）：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢  [☰] [←] [→]                        [+ 新建会话]       [👤] │
 * ├────────┬─────────────────────────────────────────────────────────────┤
 * │NavRail │                                                             │
 * │  56px  │                    Main Content                             │
 * │        │                                                             │
 * └────────┴─────────────────────────────────────────────────────────────┘
 *
 * TitleBar h-11 (44px) - 包含红绿灯、导航、新建会话、用户头像
 * NavRail w-14 (56px) - 左侧导航栏
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top: Title Bar (full width, with traffic lights) */}
      <TitleBar />

      {/* Bottom: NavRail + Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Navigation Rail */}
        <NavRail />

        {/* Main Content */}
        <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
