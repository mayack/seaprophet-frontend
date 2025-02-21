import { formatValueDisplay, getUnit, getValue } from '@/lib/units'
import { IconDirection } from './IconDirection'
import {
  TemperatureItemProps,
  WaveItemProps,
  WindItemProps,
} from '@/types/forecast'
import { WeatherIcon } from '../common/WeatherIcon'

export function WaveItem({ height, period, direction }: WaveItemProps) {
  return (
    <div className="col-span-6">
      <div className="inline-flex items-center gap-2 whitespace-nowrap rounded bg-muted px-2 py-1">
        <div className="flex min-w-12 items-baseline gap-px font-medium">
          <div className="">{getValue(height)}</div>
          <div className="text-sm">{getUnit(height)}</div>
        </div>
        <div className="flex min-w-7 items-baseline gap-px">
          <div>{getValue(period)}</div>
          <div className="text-sm">{getUnit(period)}</div>
        </div>
        <IconDirection degrees={direction.value} isWind={false} />
      </div>
    </div>
  )
}

export function SwellItem({ height, period, direction }: WaveItemProps) {
  // If height is 0, return empty div with proper column span
  if (height.value === 0) {
    return <div className="col-span-5" />
  }

  return (
    <div className="col-span-5 flex items-center gap-2 text-sm">
      <div className="font-medium">{formatValueDisplay(height)}</div>
      <div>{formatValueDisplay(period)}</div>
      <IconDirection degrees={direction.value} isWind={false} size="small" />
    </div>
  )
}

export function WindItem({ speed, gust, direction }: WindItemProps) {
  const [speedValue, unit] = [speed.value.toString(), speed.unit]
  const gustValue = gust.value.toString()

  return (
    <div className="col-span-5 flex items-center gap-3">
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center text-lg">{speedValue}</div>
        <div className="flex flex-col">
          <div className="text-2xs leading-none">{gustValue}</div>
          <div className="text-2xs leading-none">{unit}</div>
        </div>
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
        <IconDirection degrees={direction.value} isWind={true} size="large" />
      </div>
    </div>
  )
}

export function TemperatureItem({
  airTemp,
  weatherType,
}: TemperatureItemProps) {
  return (
    <div className="col-span-3 flex items-center gap-2 text-sm">
      <WeatherIcon weatherType={weatherType} />
      {formatValueDisplay(airTemp)}
    </div>
  )
}
