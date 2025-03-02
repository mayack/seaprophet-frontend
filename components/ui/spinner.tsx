import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import React from 'react'

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
}

export function Spinner({
  className,
  size = 'md',
  ...props
}: SpinnerProps): React.JSX.Element {
  return (
    <div className={cn('animate-spin text-foreground', className)} {...props}>
      <Loader2 className={sizeClasses[size]} />
    </div>
  )
}
