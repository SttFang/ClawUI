/**
 * TrafficLights - 自定义窗口控制按钮（红绿灯）
 *
 * 在 macOS 上模拟原生红绿灯样式，保持与 TitleBar 对齐
 * 按钮颜色：关闭(红)、最小化(黄)、最大化(绿)
 */
export function TrafficLights() {
  const handleClose = () => {
    window.electron?.app.close()
  }

  const handleMinimize = () => {
    window.electron?.app.minimize()
  }

  const handleMaximize = () => {
    window.electron?.app.maximize()
  }

  return (
    <div className="titlebar-no-drag flex items-center gap-2">
      {/* Close - Red */}
      <button
        type="button"
        onClick={handleClose}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f57] transition-opacity hover:opacity-80"
        title="关闭"
      >
        <span className="hidden text-[8px] font-bold text-black/50 group-hover:inline">✕</span>
      </button>

      {/* Minimize - Yellow */}
      <button
        type="button"
        onClick={handleMinimize}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#febc2e] transition-opacity hover:opacity-80"
        title="最小化"
      >
        <span className="hidden text-[8px] font-bold text-black/50 group-hover:inline">−</span>
      </button>

      {/* Maximize - Green */}
      <button
        type="button"
        onClick={handleMaximize}
        className="group flex h-3 w-3 items-center justify-center rounded-full bg-[#28c840] transition-opacity hover:opacity-80"
        title="最大化"
      >
        <span className="hidden text-[8px] font-bold text-black/50 group-hover:inline">+</span>
      </button>
    </div>
  )
}
