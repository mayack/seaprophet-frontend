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
    <div className={cn(className, 'grid grid-cols-2 gap-x-8 gap-y-3')}>
      <InfoBreakdownLine
        icon={<Sunrise />}
        label="Sunrise"
        value={astronomical.sunrise}
      />
      <InfoBreakdownLine
        icon={<Sunset />}
        label="Sunset"
        value={astronomical.sunset}
      />
      <InfoBreakdownLine
        icon={<Moon />}
        label="First light"
        value={astronomical.firstLight}
      />
      <InfoBreakdownLine
        icon={<MoonStar />}
        label="Last light"
        value={astronomical.lastLight}
      />
    </div>
  )
}
