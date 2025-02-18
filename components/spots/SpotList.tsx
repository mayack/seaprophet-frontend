import React from 'react'
import { ArrowUp, MousePointer2, Sun } from 'lucide-react'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import dynamic from 'next/dynamic'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'
import { GeneralBreakdown } from './GeneralBreakdown'

const TideChart = dynamic(() => import('@/components/spots/TideChart'), {
  ssr: false,
})

interface SpotForecastProps {
  data: ForecastProps[]
  units: {
    wind_speed: string
    swell_height: string
    tide_height: string
    temperature: string
    surf_height: string
  }
}

interface DirectionProps {
  degrees: string
  isWind: boolean
  size?: 'small' | 'medium' | 'large'
}

interface WaveItemProps {
  height: string
  period: string
  direction: string
}

interface SwellItemProps extends WaveItemProps {}

interface WindItemProps {
  speed: string
  gust: string
  direction: string
}

interface TemperatureItemProps {
  airTemp: string
}

const getCardinalDirection = (degrees: string): string => {
  const numericDegrees = parseInt(degrees.replace('°', ''), 10)
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  const index = Math.round(numericDegrees / 22.5) % 16
  return directions[index]
}

function Direction({ degrees, isWind, size = 'medium' }: DirectionProps) {
  const numericDegrees = parseFloat(degrees)
  const intDegrees = Math.round(numericDegrees) - 180
  const cardinalDirection = getCardinalDirection(degrees)
  const adjustedDegrees = isWind ? intDegrees : (intDegrees + 45) % 360
  const Icon = isWind ? ArrowUp : MousePointer2
  const sizes = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5',
  }
  const iconSize = sizes[size]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="flex">
          <div className="relative inline-flex items-center justify-center">
            <Icon
              className={`${iconSize} text-foreground`}
              style={{ transform: `rotate(${adjustedDegrees}deg)` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {degrees} {cardinalDirection}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function WaveItem({ height, period, direction }: WaveItemProps) {
  return (
    <div className="col-span-6">
      <div className="inline-flex gap-2 items-center bg-muted rounded py-1 px-2 whitespace-nowrap">
        <div className="font-medium">{height}</div>
        <div>{period}</div>
        <Direction degrees={direction} isWind={false} />
      </div>
    </div>
  )
}

function SwellItem({ height, period, direction }: SwellItemProps) {
  return (
    <div className="text-sm col-span-5 flex gap-2 items-center">
      <span className="font-medium">{height}</span>
      <span>{period}</span>
      <Direction degrees={direction} isWind={false} size="small" />
    </div>
  )
}

function WindItem({ speed, gust, direction }: WindItemProps) {
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
        <Direction degrees={direction} isWind={true} size="large" />
      </div>
    </div>
  )
}

function TemperatureItem({ airTemp }: TemperatureItemProps) {
  return (
    <div className="col-span-3 text-sm flex items-center gap-2">
      <Sun className="w-4 h-4" />
      {airTemp}
    </div>
  )
}

export function SpotList({ data }: SpotForecastProps) {
  return (
    <div className="relative container mx-auto">
      <div className="sticky top-0 bg-background flex items-center gap-16 py-2 z-20">
        <div className="w-72 font-medium">Forecast</div>
        <div className="grid grid-cols-32 flex-1 text-xs font-semibold">
          <div className="col-span-3">Time</div>
          <div className="col-span-6">Surf</div>
          <div className="col-span-5">Primary Swell</div>
          <div className="col-span-5">Secondary Swell</div>
          <div className="col-span-5">Wind Wave</div>
          <div className="col-span-5">Wind</div>
          <div className="col-span-3">Weather</div>
        </div>
      </div>
      <div className="space-y-16 pt-2">
        {data.map((day) => (
          <div key={day.date} className="flex gap-16">
            <aside className="w-72 flex flex-col gap-8 pt-3">
              <h3>
                <div className="text-3xl font-semibold">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                  })}
                </div>
                <div className="text-muted-foreground">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </h3>

              <TideChart data={day.tides} astronomical={day.astronomical} />
              <div className="space-y-4">
                <AstronomicalBreakdown astronomical={day.astronomical} />
                <GeneralBreakdown general={day.general} />
              </div>
            </aside>
            <div className="flex-1">
              {Object.entries(day.forecast).map(([hour, forecast], index) => (
                <div
                  key={hour}
                  className={`py-2.5 grid grid-cols-32 items-center ${index !== 0 ? 'border-t' : ''}`}
                >
                  <div className="col-span-3 text-xs">{hour}</div>
                  <WaveItem
                    height={forecast.waveHeight}
                    period={forecast.wavePeriod}
                    direction={forecast.waveDirection}
                  />
                  <SwellItem
                    height={forecast.swellHeight}
                    period={forecast.swellPeriod}
                    direction={forecast.swellDirection}
                  />
                  <SwellItem
                    height={forecast.secondarySwellHeight}
                    period={forecast.secondarySwellPeriod}
                    direction={forecast.secondarySwellDirection}
                  />
                  <SwellItem
                    height={forecast.windWaveHeight}
                    period={forecast.windWavePeriod}
                    direction={forecast.windWaveDirection}
                  />
                  <WindItem
                    speed={forecast.windSpeed}
                    gust={forecast.gust}
                    direction={forecast.windDirection}
                  />
                  <TemperatureItem airTemp={forecast.airTemperature} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
