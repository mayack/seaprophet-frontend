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
      <div className="inline-flex gap-2 items-center bg-muted rounded py-1 px-2 whitespace-nowrap">
        <div className="flex items-baseline gap-px font-medium min-w-12">
          <div className="">{getValue(height)}</div>
          <div className="text-sm">{getUnit(height)}</div>
        </div>
        <div className="flex items-baseline gap-px min-w-7">
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
    <div className="text-sm col-span-5 flex gap-2 items-center">
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
    <div className="col-span-5 flex gap-3 items-center">
      <div className="flex items-center gap-1">
        <div className="min-w-7 text-center text-lg">{speedValue}</div>
        <div className="flex flex-col">
          <div className="text-2xs leading-none">{gustValue}</div>
          <div className="text-2xs leading-none">{unit}</div>
        </div>
      </div>
      <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center">
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
    <div className="col-span-3 text-sm flex items-center gap-2">
      <WeatherIcon weatherType={weatherType} />
      {formatValueDisplay(airTemp)}
    </div>
  )
}
