import { IconDirection } from './IconDirection'
import { WeatherIcon } from '../common/WeatherIcon'
import { formatValueWithUnit, formatUnit } from '@/lib/units'
import {
  TemperatureItemProps,
  WaveItemProps,
  WindItemProps,
} from '@/types/forecast'

export function WaveItem({ height, period, direction, unit }: WaveItemProps) {
  return (
    <div className="col-span-6">
      <div className="inline-flex items-center gap-2 whitespace-nowrap rounded bg-muted px-2 py-1">
        <div className="flex min-w-12 items-baseline gap-px font-medium">
          <div>{height}</div>
          <div className="text-sm">{formatUnit(unit)}</div>
        </div>
        <div className="flex min-w-7 items-baseline gap-px">
          <div>{period}</div>
          <div className="text-sm">s</div>
        </div>
        <IconDirection degrees={direction} isWind={false} />
      </div>
    </div>
  )
}

export function SwellItem({ height, period, direction, unit }: WaveItemProps) {
  if (height === 0) return <div className="col-span-5" />

  return (
    <div className="col-span-5 flex items-center gap-2 text-sm">
      <div className="font-medium">{formatValueWithUnit(height, unit)}</div>
      <div>{period}s</div>
      <IconDirection degrees={direction} isWind={false} size="small" />
    </div>
  )
}

export function WindItem({ speed, gust, direction, unit }: WindItemProps) {
  return (
    <div className="col-span-5 flex items-center gap-3">
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center text-lg">{speed}</div>
        <div className="flex flex-col">
          <div className="text-2xs leading-none">{gust}</div>
          <div className="text-2xs leading-none">{formatUnit(unit)}</div>
        </div>
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
        <IconDirection degrees={direction} isWind={true} size="large" />
      </div>
    </div>
  )
}

export function TemperatureItem({
  airTemp,
  weatherType,
  unit,
}: TemperatureItemProps) {
  return (
    <div className="col-span-3 flex items-center gap-2 text-sm">
      <WeatherIcon weatherType={weatherType} />
      {formatValueWithUnit(airTemp, unit)}
    </div>
  )
}
