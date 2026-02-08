import { cn } from '@/lib/utils'

export interface TabSwitcherOption {
  value: string
  label: string
}

export interface TabSwitcherProps {
  options: TabSwitcherOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * TabSwitcher - Compact tab switcher for title bar
 *
 * Features:
 * - Pill-style container with rounded background
 * - Active tab has white/elevated background
 * - Uses titlebar-no-drag for clickability
 */
export function TabSwitcher({ options, value, onChange, className }: TabSwitcherProps) {
  return (
    <div
      className={cn(
        'titlebar-no-drag inline-flex h-7 items-center gap-0.5 rounded-lg bg-muted p-0.5',
        className
      )}
    >
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-6 items-center justify-center rounded-md px-3 text-xs font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
