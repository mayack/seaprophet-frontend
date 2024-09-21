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
import { TrendingUp } from 'lucide-react'
import { ForecastProps } from '@/api/polvo/interfaces/forecast'
import { TideChart } from '@/components/spots/TideChart'
import { UserUnits } from '@/api/sargo/interfaces/user'
import {
  formatDirection,
  formatHeight,
  formatTemperature,
  formatWindSpeed,
} from '@/lib/units'

interface SpotForecastProps {
  data: ForecastProps[]
  units: UserUnits
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
                      value={`${formatHeight(forecast.waveHeight, units.surf_height)} @ ${forecast.wavePeriod?.toFixed(1)}s ${formatDirection(forecast.waveDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.swellHeight, units.swell_height)} @ ${forecast.swellPeriod?.toFixed(1)}s ${formatDirection(forecast.swellDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.secondarySwellHeight, units.swell_height)} @ ${forecast.secondarySwellPeriod?.toFixed(1)}s ${formatDirection(forecast.secondarySwellDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.windWaveHeight, units.surf_height)} @ ${forecast.windWavePeriod?.toFixed(1)}s ${formatDirection(forecast.windWaveDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatWindSpeed(forecast.windSpeed, units.wind_speed)} (${formatWindSpeed(forecast.gust, units.wind_speed)}) ${formatDirection(forecast.windDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatTemperature(forecast.airTemperature, units.temperature)} / ${formatTemperature(forecast.waterTemperature, units.temperature)}`}
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

function ForecastItem({ value }: { value: string }) {
  return <div className="text-sm">{value}</div>
}
