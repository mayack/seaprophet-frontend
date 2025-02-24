import { useMemo } from 'react'
import { ArrowUp, MousePointer2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DirectionProps } from '@/types/forecast'

const directions = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

const sizes = {
  small: 'w-3 h-3',
  medium: 'w-3 h-3 lg:w-4 lg:h-4',
  large: 'w-4 h-4 xl:w-5 xl:h-5',
} as const

export function IconDirection({
  degrees,
  isWind,
  size = 'medium',
}: DirectionProps) {
  const { adjustedDegrees, cardinalDirection } = useMemo(() => {
    const intDegrees = Math.round(degrees) - 180
    const index = Math.round(degrees / 22.5) % 16

    return {
      adjustedDegrees: isWind ? intDegrees : (intDegrees + 45) % 360,
      cardinalDirection: directions[index],
    }
  }, [degrees, isWind])

  const Icon = isWind ? ArrowUp : MousePointer2

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className="flex"
          aria-label={`Direction: ${degrees}&deg; ${cardinalDirection}`}
        >
          <div className="relative inline-flex items-center justify-center">
            <Icon
              className={`${sizes[size]} text-foreground`}
              style={{ transform: `rotate(${adjustedDegrees}deg)` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs font-semibold leading-none">
            {degrees}&deg; {cardinalDirection}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
