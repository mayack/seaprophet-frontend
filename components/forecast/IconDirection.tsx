import { useMemo } from 'react'
import { ArrowUp, MousePointer2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import React from 'react'

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
  small: 'size-2.5 md:size-3',
  medium: 'size-3.5 md:size-4',
  large: 'size-5',
} as const

export function IconDirection({
  degrees,
  isWind,
  size = 'medium',
}: {
  degrees: number
  isWind: boolean
  size?: 'small' | 'medium' | 'large'
}): React.JSX.Element {
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
    <Tooltip>
      <TooltipTrigger
        className="flex"
        aria-label={`Direction: ${degrees}° ${cardinalDirection}`}
      >
        <div className="relative inline-flex items-center justify-center">
          <Icon
            className={`${sizes[size]}`}
            style={{ transform: `rotate(${adjustedDegrees}deg)` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent
        className="text-xs leading-none font-semibold"
        sideOffset={10}
      >
        {degrees}° {cardinalDirection}
      </TooltipContent>
    </Tooltip>
  )
}
