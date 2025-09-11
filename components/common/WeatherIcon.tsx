import { WeatherType } from '@/api/polvo/interfaces/forecast'
import { WEATHER_ICONS } from '@/constants/weather'
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
  return <Icon className={className} />
}
