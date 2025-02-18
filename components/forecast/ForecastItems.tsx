import { Sun } from 'lucide-react'
import type { WaveItemProps, WindItemProps } from '@/types/forecast'
import { IconDirection } from './IconDirection'

export function WaveItem({ height, period, direction }: WaveItemProps) {
  return (
    <div className="col-span-6">
      <div className="inline-flex gap-2 items-center bg-muted rounded py-1 px-2 whitespace-nowrap">
        <div className="font-medium">{height}</div>
        <div>{period}</div>
        <IconDirection degrees={direction} isWind={false} />
      </div>
    </div>
  )
}

export function SwellItem({ height, period, direction }: WaveItemProps) {
  return (
    <div className="text-sm col-span-5 flex gap-2 items-center">
      <span className="font-medium">{height}</span>
      <span>{period}</span>
      <IconDirection degrees={direction} isWind={false} size="small" />
    </div>
  )
}

export function WindItem({ speed, gust, direction }: WindItemProps) {
  const [speedValue, unit] = speed.match(/(\d+)(\w+)/)?.slice(1) ?? ['', '']
  const gustValue = gust.match(/(\d+)/)?.[1] ?? ''

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
        <IconDirection degrees={direction} isWind={true} size="large" />
      </div>
    </div>
  )
}

export function TemperatureItem({ airTemp }: { airTemp: string }) {
  return (
    <div className="col-span-3 text-sm flex items-center gap-2">
      <Sun className="w-4 h-4" />
      {airTemp}
    </div>
  )
}
