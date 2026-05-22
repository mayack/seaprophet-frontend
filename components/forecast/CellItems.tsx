import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import {
  formatValueWithUnit,
  formatValueWithUnitSeparated,
  formatUnit,
} from '@/lib/units'
import { WeatherType } from '@/api/polvo/interfaces/forecast'
import { cn } from '@/lib/utils'
import React from 'react'

export function WaveItem({
  height,
  period,
  direction,
  unit,
  energy,
  className,
}: {
  height: number
  period: number
  direction: number
  unit: string
  energy: number
  className: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        className,
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-muted px-2 py-1 xs:gap-2'
      )}
    >
      {formatValueWithUnitSeparated(
        height,
        unit,
        'min-w-8 xs:min-w-9 font-medium'
      )}
      {formatValueWithUnitSeparated(period, 'seconds', 'min-w-5 xs:min-w-6')}
      {formatValueWithUnitSeparated(energy, 'kilojoules', 'flex-1')}
      <IconDirection degrees={direction} isWind={false} size="small" />
    </div>
  )
}

export function SwellItem({
  height,
  period,
  direction,
  unit,
  className,
}: {
  height: number
  period: number
  direction: number
  unit: string
  className: string
}): React.JSX.Element {
  if (height === 0) return <div className={className} />

  return (
    <div className={cn(className, 'items-center gap-1.5 text-xs xl:text-sm')}>
      {formatValueWithUnitSeparated(height, unit)}
      {formatValueWithUnitSeparated(period, 'seconds')}
      <IconDirection degrees={direction} isWind={false} size="small" />
    </div>
  )
}

export function WindItem({
  speed,
  gust,
  direction,
  unit,
  className,
  windRating,
}: {
  speed: number
  gust: number
  direction: number
  unit: string
  className: string
  windRating: number
}): React.JSX.Element {
  const ratingBackgrounds = {
    0: 'bg-red-200 text-red-900 dark:bg-red-600 dark:text-foreground',
    1: 'bg-orange-200 text-orange-900 dark:bg-orange-600 dark:text-foreground',
    2: 'bg-yellow-200 text-yellow-900 dark:bg-yellow-600 dark:text-foreground',
    3: 'bg-green-200 text-green-900 dark:bg-green-600 dark:text-foreground',
  } as const

  // Clamp the rating to the valid 0..3 range (and guard NaN coming from the API)
  // so an out-of-range value can't fall through to undefined / blank styling.
  const safeRating = (
    Number.isFinite(windRating)
      ? Math.max(0, Math.min(3, Math.floor(windRating)))
      : 0
  ) as keyof typeof ratingBackgrounds

  return (
    <div className={cn(className, 'flex items-center gap-1.5 xs:gap-2')}>
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center text-sm xs:text-base">{speed}</div>
        <div className="flex min-w-4 flex-col">
          <div className="text-3xs leading-none xs:text-2xs">{gust}</div>
          <div className="mt-px text-3xs leading-none xs:text-2xs">
            {formatUnit(unit)}
          </div>
        </div>
      </div>
      <div
        className={cn(
          'flex size-5 items-center justify-center rounded-full xs:size-6',
          ratingBackgrounds[safeRating]
        )}
      >
        <IconDirection degrees={direction} isWind={true} />
      </div>
    </div>
  )
}

export function TemperatureItem({
  airTemp,
  weatherType,
  unit,
  className,
}: {
  airTemp: number
  weatherType: WeatherType
  unit: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn(className, 'flex items-center gap-1.5 xs:gap-2')}>
      <WeatherIcon weatherType={weatherType} className="size-3 xs:size-4" />
      <span className="text-xs xs:text-sm">
        {formatValueWithUnit(airTemp, unit)}
      </span>
    </div>
  )
}
