import { WeatherType } from '@/api/polvo/interfaces/forecast'
import { WEATHER_ICONS, WEATHER_LABELS } from '@/constants/weather'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import React from 'react'

interface WeatherIconProps {
  weatherType: WeatherType
  className?: string
}

export function WeatherIcon({
  weatherType,
  className,
}: WeatherIconProps): React.JSX.Element {
  const Icon = WEATHER_ICONS[weatherType] || WEATHER_ICONS['clear-day']
  const label = WEATHER_LABELS[weatherType] || WEATHER_LABELS['clear-day']

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex" aria-label={label}>
            <Icon className={className} />
          </span>
        }
      />
      <TooltipContent sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  )
}
