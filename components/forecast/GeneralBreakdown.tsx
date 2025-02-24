import { Droplet } from 'lucide-react'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'
import type { General } from '@/api/polvo/interfaces/forecast'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { formatValueWithUnit } from '@/lib/units'

interface GeneralBreakdownProps {
  general: General
  units: UserUnits
}

export function GeneralBreakdown({ general, units }: GeneralBreakdownProps) {
  return (
    <div className="flex flex-col flex-wrap sm:flex-row lg:flex-col">
      <InfoBreakdownLine
        icon={<Droplet className="h-3 w-3 sm:h-4 sm:w-4" />}
        label="Water temperature"
        value={formatValueWithUnit(
          general.averageWaterTemperature,
          units.temperature
        )}
      />
    </div>
  )
}
