import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
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
    <div className="space-y-6">
      {data.map((day) => (
        <Card key={day.date}>
          <CardHeader>
            <CardTitle>
              {new Date(day.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </CardTitle>
            <CardDescription>Tidal and Weather Forecast</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-10">
              <div className="grid grid-cols-7 text-xs font-medium">
                <div>Time</div>
                <div>Wave</div>
                <div>Primary Swell</div>
                <div>Secondary Swell</div>
                <div>Wind Wave</div>
                <div>Wind</div>
                <div>Temperature</div>
              </div>
              {Object.entries(day.forecast).map(([hour, forecast]) => (
                <React.Fragment key={hour}>
                  <div className="grid grid-cols-7 text-sm">
                    <div>{hour}</div>
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
                  <Separator className="my-2" />
                </React.Fragment>
              ))}
            </div>
            <TideChart
              data={day.tides.map((tide) => ({
                ...tide,
                height: tide.height.toString(),
                type: tide.type as 'high' | 'low',
              }))}
            />
          </CardContent>
        </Card>
      ))}
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
    <div className="text-sm flex items-center">
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
    <div className="text-sm flex items-center space-x-2">
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
