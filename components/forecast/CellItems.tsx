import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import { formatValueWithUnit, formatUnit } from '@/lib/units'
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-muted px-2 py-1 xl:gap-2'
      )}
    >
      <div className="flex min-w-9 items-baseline gap-px font-medium xl:min-w-10">
        <div className="text-sm xl:text-base">{height}</div>
        <div className="text-xs">{formatUnit(unit)}</div>
      </div>
      <div className="flex min-w-5 items-baseline gap-px xl:min-w-6">
        <div className="text-xs xl:text-sm">{period}</div>
        <div className="text-xs">s</div>
      </div>
      <div className="flex flex-1 items-baseline gap-px">
        <div className="text-xs xl:text-sm">{energy}</div>
        <div className="text-xs">kJ</div>
      </div>
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
  }

  return (
    <div className={cn(className, 'flex items-center gap-1.5')}>
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center text-sm xl:text-base">{speed}</div>
        <div className="flex min-w-4 flex-col">
          <div className="text-2xs leading-none">{gust}</div>
          <div className="mt-px text-3xs leading-none">{formatUnit(unit)}</div>
        </div>
      </div>
      <div
        className={cn(
          'flex size-[1.25rem] items-center justify-center rounded-full xl:size-6',
          ratingBackgrounds[windRating as keyof typeof ratingBackgrounds] ||
            'bg-muted'
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
    <div className={cn(className, 'flex items-center gap-1.5 xl:gap-2')}>
      <WeatherIcon weatherType={weatherType} className="size-3 xl:size-4" />
      <span className="text-xs xl:text-sm">
        {formatValueWithUnit(airTemp, unit)}
      </span>
    </div>
  )
}
