import { cn } from '@/lib/utils'
import React from 'react'

interface InfoBreakdownLineProps {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}

export function InfoBreakdownLine({
  icon,
  label,
  value,
  className,
}: InfoBreakdownLineProps): React.JSX.Element {
  return (
    <div className={cn(className, 'flex items-center gap-3')}>
      <div className="flex flex-col gap-0.5">
        <div className="text-2xs font-medium text-muted-foreground">
          {label}
        </div>
        <div className="flex items-center gap-1 [&>svg]:size-3">
          {icon}
          <div className="text-xs">{value}</div>
        </div>
      </div>
    </div>
  )
}
