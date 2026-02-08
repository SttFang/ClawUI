import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface IconActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  isActive?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * IconActionButton - Minimal icon button for toolbar actions
 *
 * Features:
 * - No background by default
 * - Subtle hover state
 * - Active state with primary color
 * - Uses titlebar-no-drag to make it clickable in drag region
 */
const IconActionButton = forwardRef<HTMLButtonElement, IconActionButtonProps>(
  ({ icon, isActive = false, size = 'md', className, disabled, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-6 w-6 text-sm',
      md: 'h-7 w-7 text-base',
      lg: 'h-8 w-8 text-lg',
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'titlebar-no-drag inline-flex items-center justify-center rounded-md transition-colors',
          'text-muted-foreground',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          isActive && 'bg-accent text-foreground',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {icon}
      </button>
    )
  }
)

IconActionButton.displayName = 'IconActionButton'

export { IconActionButton }
