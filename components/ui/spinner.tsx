import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg'
}

const sizeClasses = {
  sm: 'h-4 w-4',
  default: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export function Spinner({
  className,
  size = 'default',
  ...props
}: SpinnerProps) {
  return (
    <div className={cn('animate-spin', className)} {...props}>
      <Loader2 className={sizeClasses[size]} />
    </div>
  )
}
