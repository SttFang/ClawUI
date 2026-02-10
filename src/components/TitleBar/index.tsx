import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LanguageManager } from "@/components/LanguageManager";

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
      className="titlebar flex h-11 w-full shrink-0 items-center justify-end gap-1 border-b border-border bg-sidebar pr-2"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <LanguageManager />
      <ConnectionStatus />
    </div>
  );
}
