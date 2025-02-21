import { Sunrise, Sunset, Moon, MoonStar } from 'lucide-react'
import { Astronomical } from '@/api/polvo/interfaces/forecast'
import { InfoBreakdownLine } from '../common/InfoBreakdownLine'

interface AstronomicalBreakdownProps {
  astronomical: Astronomical
}

export function AstronomicalBreakdown({
  astronomical,
}: AstronomicalBreakdownProps) {
  return (
    <div className="space-y-1">
      <InfoBreakdownLine
        icon={<MoonStar className="h-4 w-4" />}
        label="First Light"
        value={astronomical.firstLight}
      />
      <InfoBreakdownLine
        icon={<Sunrise className="h-4 w-4" />}
        label="Sunrise"
        value={astronomical.sunrise}
      />
      <InfoBreakdownLine
        icon={<Sunset className="h-4 w-4" />}
        label="Sunset"
        value={astronomical.sunset}
      />
      <InfoBreakdownLine
        icon={<Moon className="h-4 w-4" />}
        label="Last Light"
        value={astronomical.lastLight}
      />
    </div>
  )
}
