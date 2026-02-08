import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'

export interface UserAvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * UserAvatar - Compact avatar for title bar
 *
 * Features:
 * - Image with fallback to initials or icon
 * - Multiple sizes (sm: 24px, md: 28px, lg: 32px)
 * - Uses titlebar-no-drag for clickability
 */
const UserAvatar = forwardRef<HTMLDivElement, UserAvatarProps>(
  ({ src, alt, fallback, size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-6 w-6 text-xs',
      md: 'h-7 w-7 text-sm',
      lg: 'h-8 w-8 text-sm',
    }

    const iconSizes = {
      sm: 12,
      md: 14,
      lg: 16,
    }

    return (
      <div
        ref={ref}
        className={cn(
          'titlebar-no-drag inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-muted transition-opacity hover:opacity-80',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img src={src} alt={alt || 'Avatar'} className="h-full w-full object-cover" />
        ) : fallback ? (
          <span className="font-medium uppercase text-muted-foreground">{fallback.charAt(0)}</span>
        ) : (
          <User size={iconSizes[size]} className="text-muted-foreground" />
        )}
      </div>
    )
  }
)

UserAvatar.displayName = 'UserAvatar'

export { UserAvatar }
