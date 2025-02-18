import { Sunrise, Sunset, Moon, MoonStar } from 'lucide-react'
import { AstronomicalProps } from '@/api/polvo/interfaces/forecast'
import { InfoBreakdownLine } from './InfoBreakdownLine'

interface AstronomicalBreakdownProps {
  astronomical: AstronomicalProps
}

export function AstronomicalBreakdown({
  astronomical,
}: AstronomicalBreakdownProps) {
  return (
    <div className="space-y-2">
      <InfoBreakdownLine
        icon={<MoonStar className="w-4 h-4" />}
        label="First Light"
        value={astronomical.firstLight}
      />
      <InfoBreakdownLine
        icon={<Sunrise className="w-4 h-4" />}
        label="Sunrise"
        value={astronomical.sunrise}
      />
      <InfoBreakdownLine
        icon={<Sunset className="w-4 h-4" />}
        label="Sunset"
        value={astronomical.sunset}
      />
      <InfoBreakdownLine
        icon={<Moon className="w-4 h-4" />}
        label="Last Light"
        value={astronomical.lastLight}
      />
    </div>
  )
}
