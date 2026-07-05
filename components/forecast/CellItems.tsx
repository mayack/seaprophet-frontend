import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import { formatValueWithUnitSeparated, formatUnit } from '@/lib/units'
import { WeatherType } from '@/api/polvo/interfaces/forecast'
import { cn } from '@/lib/utils'
import React from 'react'

export function SurfItem({
  height,
  period,
  direction,
  unit,
  className,
}: {
  height: number
  period: number
  /** Omit to hide the direction icon (map spot cards). */
  direction?: number
  unit: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        className,
        'inline-flex items-center gap-2 rounded-md bg-muted p-1.5 whitespace-nowrap'
      )}
    >
      <div className="flex flex-1 items-center">
        {formatValueWithUnitSeparated(height, unit, 'font-medium flex-1')}
        {formatValueWithUnitSeparated(period, 'seconds', 'flex-1 justify-end')}
      </div>
      {direction !== undefined && (
        <IconDirection degrees={direction} isWind={false} size="small" />
      )}
    </div>
  )
}

export function EnergyItem({
  energy,
  className,
}: {
  energy: number
  className?: string
}): React.JSX.Element {
  return (
    <div className={className}>
      {formatValueWithUnitSeparated(energy, 'kilojoules')}
    </div>
  )
}

export function WaveItem({
  height,
  unit,
  energy,
  className,
}: {
  height: number
  unit: string
  energy: number
  className: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        className,
        'inline-flex items-center gap-1.5 rounded-md bg-muted p-1.5 whitespace-nowrap'
      )}
    >
      {formatValueWithUnitSeparated(height, unit, 'flex-1 font-medium')}
      {formatValueWithUnitSeparated(energy, 'kilojoules')}
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
    <div className={cn(className, 'flex items-center gap-1.5 text-sm')}>
      {formatValueWithUnitSeparated(height, unit)}
      {formatValueWithUnitSeparated(period, 'seconds')}
      <IconDirection degrees={direction} isWind={false} size="small" />
    </div>
  )
}

export const WIND_RATING_BACKGROUNDS = {
  0: 'bg-red-200 text-red-900 dark:bg-red-600 dark:text-foreground',
  1: 'bg-orange-200 text-orange-900 dark:bg-orange-600 dark:text-foreground',
  2: 'bg-yellow-200 text-yellow-900 dark:bg-yellow-600 dark:text-foreground',
  3: 'bg-green-200 text-green-900 dark:bg-green-600 dark:text-foreground',
} as const

/** Rating-coloured circle + wind direction arrow — the "wind bubble".
 *  Shared by the forecast table's WindItem and the map/nearby spot cards. */
export function WindRatingBubble({
  direction,
  windRating,
  size = 'default',
  className,
}: {
  direction: number
  windRating: number
  /** `sm` for the compact spot cards; `default` matches the forecast table. */
  size?: 'default' | 'sm'
  className?: string
}): React.JSX.Element {
  const safeRating = (
    Number.isFinite(windRating)
      ? Math.max(0, Math.min(3, Math.floor(windRating)))
      : 0
  ) as keyof typeof WIND_RATING_BACKGROUNDS

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'size-4' : 'size-5',
        WIND_RATING_BACKGROUNDS[safeRating],
        className
      )}
    >
      <IconDirection
        degrees={direction}
        isWind={true}
        size={size === 'sm' ? 'smallPlus' : 'medium'}
      />
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
  return (
    <div className={cn(className, 'flex items-center gap-2')}>
      <div className="flex items-center gap-1.5">
        <div className="min-w-5 text-center text-xs/[1]">{speed}</div>
        <div className="flex min-w-4 flex-col">
          <div className="text-3xs/[1] leading-none">{gust}</div>
          <div className="mt-px text-3xs/[1] leading-none">
            {formatUnit(unit)}
          </div>
        </div>
      </div>
      <WindRatingBubble direction={direction} windRating={windRating} />
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
    <div className={cn(className, 'flex items-center gap-1.5 md:gap-2')}>
      <WeatherIcon weatherType={weatherType} className="size-3.5" />
      {formatValueWithUnitSeparated(airTemp, unit)}
    </div>
  )
}
