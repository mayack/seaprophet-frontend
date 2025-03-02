import { LucideIcon } from 'lucide-react'
import React from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="wrapper pb-1">
      <div className="flex h-20 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
        <div className="mb-0.5 flex items-center gap-2 font-medium">
          <Icon className="size-4" strokeWidth="2" />
          {title}
        </div>
        <div className="px-12 text-xs leading-tight text-muted-foreground xs:text-sm">
          {description}
        </div>
      </div>
    </div>
  )
}
