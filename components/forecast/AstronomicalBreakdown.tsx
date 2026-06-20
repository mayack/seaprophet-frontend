import { Sunrise, Sunset, Moon, MoonStar } from 'lucide-react'
import { Astronomical } from '@/api/polvo/interfaces/forecast'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'
import { cn } from '@/lib/utils'
import React from 'react'

interface AstronomicalBreakdownProps {
  astronomical: Astronomical
  className?: string
}

export function AstronomicalBreakdown({
  astronomical,
  className,
}: AstronomicalBreakdownProps): React.JSX.Element {
  return (
    <div
      className={cn(className, 'grid grid-cols-2 gap-x-6 gap-y-3 sm:gap-x-8')}
    >
      <InfoBreakdownLine
        icon={<Moon />}
        label="First light"
        value={astronomical.firstLight}
      />
      <InfoBreakdownLine
        icon={<Sunrise />}
        label="Sunrise"
        value={astronomical.sunrise}
      />
      <InfoBreakdownLine
        icon={<MoonStar />}
        label="Last light"
        value={astronomical.lastLight}
      />
      <InfoBreakdownLine
        icon={<Sunset />}
        label="Sunset"
        value={astronomical.sunset}
      />
    </div>
  )
}
