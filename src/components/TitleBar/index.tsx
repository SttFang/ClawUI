/**
 * TitleBar - 应用顶边栏
 *
 * 布局：
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 🔴🟡🟢 (原生)                                                        │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * 整个栏为拖动区域，仅保留原生红绿灯
 */
export function TitleBar() {
  return (
    <div
      className="titlebar h-11 w-full shrink-0 border-b border-border bg-sidebar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    />
  )
}
