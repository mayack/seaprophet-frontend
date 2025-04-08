import { Sunrise, Sunset, Moon, MoonStar, Droplet } from 'lucide-react'
import { Astronomical, General } from '@/api/polvo/interfaces/forecast'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'
import { UserUnits } from '@/api/sargo/interfaces/user'
import { cn } from '@/lib/utils'
import { formatValueWithUnit } from '@/lib/units'
import React from 'react'

interface AstronomicalBreakdownProps {
  astronomical: Astronomical
  general: General
  units: UserUnits
  className?: string
}

export function AstronomicalBreakdown({
  astronomical,
  general,
  units,
  className,
}: AstronomicalBreakdownProps): React.JSX.Element {
  return (
    <div
      className={cn(
        className,
        'grid w-full grid-cols-3 gap-x-6 gap-y-2 md:grid-cols-5 lg:grid-cols-3'
      )}
    >
      <InfoBreakdownLine
        icon={<Moon className="size-5" />}
        label="First light"
        value={astronomical.firstLight}
        className="md:order-1"
      />
      <InfoBreakdownLine
        icon={<Sunrise className="size-5" />}
        label="Sunrise"
        value={astronomical.sunrise}
        className="md:order-3 lg:order-2"
      />
      <InfoBreakdownLine
        icon={<Droplet className="size-5" />}
        label="Water"
        value={formatValueWithUnit(
          general.averageWaterTemperature,
          units.temperature
        )}
        className="md:order-5 lg:order-3"
      />
      <InfoBreakdownLine
        icon={<MoonStar className="size-5" />}
        label="Last light"
        value={astronomical.lastLight}
        className="md:order-4 lg:order-4"
      />
      <InfoBreakdownLine
        icon={<Sunset className="size-5" />}
        label="Sunset"
        value={astronomical.sunset}
        className="md:order-3 lg:order-5"
      />
    </div>
  )
}
