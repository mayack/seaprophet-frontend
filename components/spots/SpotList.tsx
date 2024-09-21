import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TrendingUp, ArrowUp, MousePointer2, Sun, Droplet } from 'lucide-react'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { TideChart } from '@/components/spots/TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatHeight,
  formatPeriod,
  formatTemperature,
  formatWindSpeed,
} from '@/lib/units'

interface SpotForecastProps {
  data: ForecastProps[]
  units: UserUnits
}

const getCardinalDirection = (degrees: number): string => {
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
  const index = Math.round(degrees / 22.5) % 16
  return directions[index]
}

interface DirectionProps {
  degrees: number
  isWind: boolean
}

function Direction({ degrees, isWind }: DirectionProps) {
  const intDegrees = Math.round(degrees) - 180
  const cardinalDirection = getCardinalDirection(intDegrees)

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
            {intDegrees}° {cardinalDirection}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function SpotList({ data, units }: SpotForecastProps) {
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
                      value={`${formatHeight(forecast.waveHeight, units.surf_height)} @ ${formatPeriod(forecast.wavePeriod)}`}
                      direction={forecast.waveDirection}
                      isWind={false}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.swellHeight, units.swell_height)} @ ${formatPeriod(forecast.swellPeriod)}`}
                      direction={forecast.swellDirection}
                      isWind={false}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.secondarySwellHeight, units.swell_height)} @ ${formatPeriod(forecast.secondarySwellPeriod)}`}
                      direction={forecast.secondarySwellDirection}
                      isWind={false}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.windWaveHeight, units.surf_height)} @ ${formatPeriod(forecast.windWavePeriod)}`}
                      direction={forecast.windWaveDirection}
                      isWind={false}
                    />
                    <ForecastItem
                      value={`${formatWindSpeed(forecast.windSpeed, units.wind_speed)} (${formatWindSpeed(forecast.gust, units.wind_speed)})`}
                      direction={forecast.windDirection}
                      isWind={true}
                    />
                    <TemperatureItem
                      airTemp={formatTemperature(
                        forecast.airTemperature,
                        units.temperature
                      )}
                      waterTemp={formatTemperature(
                        forecast.waterTemperature,
                        units.temperature
                      )}
                    />
                  </div>
                  <Separator className="my-2" />
                </React.Fragment>
              ))}
            </div>
            <TideChart data={day.tides} units={units} />
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 font-medium leading-none">
              Tide range:{' '}
              {formatHeight(
                Math.min(...day.tides.map((t) => t.height)),
                units.tide_height
              )}{' '}
              -{' '}
              {formatHeight(
                Math.max(...day.tides.map((t) => t.height)),
                units.tide_height
              )}
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Showing tidal and weather forecast for the day
            </div>
          </CardFooter>
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
  direction?: number
  isWind?: boolean
}) {
  return (
    <div className="text-sm flex items-center">
      <span>{value}</span>
      {direction !== undefined && (
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
