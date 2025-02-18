import { Droplet } from 'lucide-react'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'

interface GeneralBreakdownProps {
  general: {
    averageWaterTemperature: string
  }
}

export function GeneralBreakdown({ general }: GeneralBreakdownProps) {
  return (
    <div className="space-y-1">
      <InfoBreakdownLine
        icon={<Droplet className="w-4 h-4" />}
        label="Water Temperature"
        value={general.averageWaterTemperature}
      />
    </div>
  )
}
