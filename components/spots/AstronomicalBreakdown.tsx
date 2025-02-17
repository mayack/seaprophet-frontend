import { Sunrise, Sunset, Moon, MoonStar } from 'lucide-react'
import { AstronomicalProps } from '@/api/polvo/interfaces/forecast'

interface AstronomicalBreakdownProps {
  astronomical: AstronomicalProps
}

export function AstronomicalBreakdown({
  astronomical,
}: AstronomicalBreakdownProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MoonStar className="w-4 h-4" />
          <span className="text-sm font-medium">First Light</span>
        </div>
        <span className="font-mono text-sm">{astronomical.firstLight}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-4 h-4" />
          <span className="text-sm font-medium">Sunrise</span>
        </div>
        <span className="font-mono text-sm">{astronomical.sunrise}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunset className="w-4 h-4" />
          <span className="text-sm font-medium">Sunset</span>
        </div>
        <span className="font-mono text-sm">{astronomical.sunset}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4" />
          <span className="text-sm font-medium">Last Light</span>
        </div>
        <span className="font-mono text-sm">{astronomical.lastLight}</span>
      </div>
    </div>
  )
}
