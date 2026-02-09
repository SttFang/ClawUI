import { ConnectionStatus } from '@/components/ConnectionStatus'

/**
 * TitleBar - 应用顶边栏
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢 (原生)                                      ● Connected   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 整个栏为拖动区域，ConnectionStatus 为 no-drag
 */
export function TitleBar() {
  return (
    <div
      className="titlebar flex h-11 w-full shrink-0 items-center justify-end border-b border-border bg-sidebar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <ConnectionStatus />
    </div>
  )
}
