import { cn } from '@/lib/utils'

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
}: InfoBreakdownLineProps) {
  return (
    <div className={cn(className, 'flex items-center gap-3')}>
      {icon}
      <div className="flex flex-col">
        <span className="text-2xs font-medium">{label}</span>
        <div className="text-sm">{value}</div>
      </div>
    </div>
  )
}
