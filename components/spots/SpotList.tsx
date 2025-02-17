import React from 'react'
import { Separator } from '@/components/ui/separator'
import { ArrowUp, MousePointer2, Sun, Droplet } from 'lucide-react'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import dynamic from 'next/dynamic'
import { AstronomicalBreakdown } from './AstronomicalBreakdown'

// Dynamically import TideChart with SSR disabled
const TideChart = dynamic(() => import('@/components/spots/TideChart'), {
  ssr: false, // Disable SSR for TideChart
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

const getCardinalDirection = (degrees: string): string => {
  const numericDegrees = parseInt(degrees.replace('°', ''), 10) // Strip degree symbol and convert to number
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

interface DirectionProps {
  degrees: string // degrees is a string (e.g., "180°")
  isWind: boolean
}

function Direction({ degrees, isWind }: DirectionProps) {
  const numericDegrees = parseFloat(degrees) // Automatically strips non-numeric characters
  const intDegrees = Math.round(numericDegrees) - 180
  const cardinalDirection = getCardinalDirection(degrees)

  // Adjust rotation for MousePointer2 icon
  const adjustedDegrees = isWind ? intDegrees : (intDegrees + 45) % 360

  const Icon = isWind ? ArrowUp : MousePointer2

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="relative inline-flex items-center justify-center w-6 h-6">
            <Icon
              className="w-4 h-4 text-foreground"
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

export function SpotList({ data }: SpotForecastProps) {
  return (
    <div className="relative">
      <div className="sticky top-0 bg-background flex items-center gap-16 py-2 z-20 border-b">
        <div className="w-80 text-lg">Forecast</div>
        <div className="flex flex-1 text-xs font-semibold">
          <div className="w-20">Time</div>
          <div className="flex-1">Wave</div>
          <div className="flex-1">Primary Swell</div>
          <div className="flex-1">Secondary Swell</div>
          <div className="flex-1">Wind Wave</div>
          <div className="flex-1">Wind</div>
          <div className="flex-1">Temperature</div>
        </div>
      </div>
      <div className="space-y-16 pt-4">
        {data.map((day) => (
          <div key={day.date} className="flex gap-16">
            <aside className="w-80 flex flex-col gap-8">
              <h3>
                <div className="text-3xl">
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

              <TideChart
                data={day.tides.map((tide) => ({
                  ...tide,
                  height: tide.height.toString(),
                  type: tide.type as 'high' | 'low',
                }))}
                astronomical={day.astronomical}
              />
              <AstronomicalBreakdown astronomical={day.astronomical} />
            </aside>
            <div className="flex-1">
              {Object.entries(day.forecast).map(([hour, forecast], index) => (
                <div
                  key={hour}
                  className={`py-3 flex text-sm ${index !== 0 ? 'border-t' : ''}`}
                >
                  <div className="text-sm w-20">{hour}</div>
                  <ForecastItem
                    value={`${forecast.waveHeight} @ ${forecast.wavePeriod}`}
                    direction={forecast.waveDirection.toString()} // Convert to string
                    isWind={false}
                  />
                  <ForecastItem
                    value={`${forecast.swellHeight} @ ${forecast.swellPeriod}`}
                    direction={forecast.swellDirection.toString()} // Convert to string
                    isWind={false}
                  />
                  <ForecastItem
                    value={`${forecast.secondarySwellHeight} @ ${forecast.secondarySwellPeriod}`}
                    direction={forecast.secondarySwellDirection.toString()} // Convert to string
                    isWind={false}
                  />
                  <ForecastItem
                    value={`${forecast.windWaveHeight} @ ${forecast.windWavePeriod}`}
                    direction={forecast.windWaveDirection.toString()} // Convert to string
                    isWind={false}
                  />
                  <ForecastItem
                    value={`${forecast.windSpeed} (${forecast.gust})`}
                    direction={forecast.windDirection.toString()} // Convert to string
                    isWind={true}
                  />
                  <TemperatureItem
                    airTemp={forecast.airTemperature}
                    waterTemp={forecast.waterTemperature}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ForecastItem({
  value,
  direction,
  isWind,
}: {
  value: string
  direction?: string // direction is now a string
  isWind?: boolean
}) {
  return (
    <div className="flex-1 text-sm flex items-center">
      <span>{value}</span>
      {direction && (
        <span className="ml-1">
          <Direction degrees={direction} isWind={isWind || false} />
        </span>
      )}
    </div>
  )
}

function TemperatureItem({
  airTemp,
  waterTemp,
}: {
  airTemp: string
  waterTemp: string
}) {
  return (
    <div className="text-sm flex flex-1 items-center space-x-2">
      <span className="flex items-center">
        <Sun className="w-4 h-4 mr-1" />
        {airTemp}
      </span>
      <span className="flex items-center">
        <Droplet className="w-4 h-4 mr-1" />
        {waterTemp}
      </span>
    </div>
  )
}
