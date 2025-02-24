import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import { formatValueWithUnit, formatUnit } from '@/lib/units'
import {
  TemperatureItemProps,
  WaveItemProps,
  WindItemProps,
} from '@/types/forecast'
import { cn } from '@/lib/utils'

export function WaveItem({
  height,
  period,
  direction,
  unit,
  className,
}: WaveItemProps) {
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
}: WaveItemProps) {
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
}: WindItemProps) {
  return (
    <div className={cn(className, 'flex items-center gap-2')}>
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center xl:min-w-8 xl:text-lg">{speed}</div>
        <div className="flex min-w-5 flex-col">
          <div className="text-2xs leading-none">{gust}</div>
          <div className="text-2xs leading-none">{formatUnit(unit)}</div>
        </div>
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted xl:h-7 xl:w-7">
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
}: TemperatureItemProps & { className?: string }) {
  return (
    <div className={cn(className, 'flex min-w-16 items-center gap-2 text-sm')}>
      <WeatherIcon weatherType={weatherType} />
      {formatValueWithUnit(airTemp, unit)}
    </div>
  )
}
