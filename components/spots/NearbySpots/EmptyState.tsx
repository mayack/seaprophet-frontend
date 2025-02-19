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
    <div className="bg-muted rounded-lg h-20 text-center flex flex-col items-center justify-center gap-px">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="w-4 h-4" strokeWidth="2" />
        {title}
      </div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </div>
  )
}
