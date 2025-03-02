import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import { formatValueWithUnit, formatUnit } from '@/lib/units'
import {
  TemperatureItemProps,
  WaveItemProps,
  WindItemProps,
} from '@/types/forecast'
import { cn } from '@/lib/utils'
import React from 'react'

export function WaveItem({
  height,
  period,
  direction,
  unit,
  className,
}: WaveItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        className,
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-muted px-2 py-1'
      )}
    >
      <div className="flex min-w-10 items-baseline gap-px font-medium xl:min-w-12">
        <div className="text-sm xl:text-base">{height}</div>
        <div className="text-sm">{formatUnit(unit)}</div>
      </div>
      <div className="flex min-w-6 flex-1 items-baseline gap-px xl:min-w-7">
        <div className="text-sm xl:text-base">{period}</div>
        <div className="text-sm">s</div>
      </div>
      <IconDirection degrees={direction} isWind={false} />
    </div>
  )
}

export function SwellItem({
  height,
  period,
  direction,
  unit,
  className,
}: WaveItemProps): React.JSX.Element {
  if (height === 0) return <div className={className} />

  return (
    <div className={cn(className, 'items-center gap-1.5 text-xs xl:text-sm')}>
      <div className="font-medium">{formatValueWithUnit(height, unit)}</div>
      <div>{period}s</div>
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
}: WindItemProps): React.JSX.Element {
  const ratingBackgrounds = {
    0: 'bg-red-100 text-red-900 dark:bg-red-600 dark:text-red-100',
    1: 'bg-orange-100 text-orange-900 dark:bg-orange-600 dark:text-orange-100',
    2: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100',
    3: 'bg-green-100 text-green-900 dark:bg-green-600 dark:text-green-100',
  }

  return (
    <div className={cn(className, 'flex items-center gap-2')}>
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center xl:min-w-8 xl:text-lg">{speed}</div>
        <div className="flex min-w-5 flex-col">
          <div className="text-2xs leading-none">{gust}</div>
          <div className="text-2xs leading-none">{formatUnit(unit)}</div>
        </div>
      </div>
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full xl:h-7 xl:w-7',
          ratingBackgrounds[windRating as keyof typeof ratingBackgrounds] ||
            'bg-muted'
        )}
      >
        <IconDirection degrees={direction} isWind={true} size="large" />
      </div>
    </div>
  )
}

export function TemperatureItem({
  airTemp,
  weatherType,
  unit,
  className,
}: TemperatureItemProps & { className?: string }): React.JSX.Element {
  return (
    <div className={cn(className, 'flex min-w-16 items-center gap-2 text-sm')}>
      <WeatherIcon weatherType={weatherType} />
      {formatValueWithUnit(airTemp, unit)}
    </div>
  )
}
