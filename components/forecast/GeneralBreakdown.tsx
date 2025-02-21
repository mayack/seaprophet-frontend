import { Droplet } from 'lucide-react'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'
import { formatValueDisplay } from '@/lib/units'
import { General } from '@/api/polvo/interfaces/forecast'

interface GeneralBreakdownProps {
  general: General
}

export function GeneralBreakdown({ general }: GeneralBreakdownProps) {
  return (
    <div className="space-y-1">
      <InfoBreakdownLine
        icon={<Droplet className="h-4 w-4" />}
        label="Water Temperature"
        value={formatValueDisplay(general.averageWaterTemperature)}
      />
    </div>
  )
}
