interface InfoBreakdownLineProps {
  icon: React.ReactNode
  label: string
  value: string
}

export function InfoBreakdownLine({
  icon,
  label,
  value,
}: InfoBreakdownLineProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <span className="font-mono">{value}</span>
    </div>
  )
}
