import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex h-20 flex-col items-center justify-center gap-px rounded-lg bg-muted text-center">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" strokeWidth="2" />
        {title}
      </div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  )
}
