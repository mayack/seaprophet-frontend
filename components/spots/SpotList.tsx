'use client'

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

interface SpotForecastProps {
  data: ForecastProps[]
  unitSystem: 'metric' | 'imperial'
}

export function SpotList({ data, unitSystem }: SpotForecastProps) {
  const formatHeight = (height: number) =>
    unitSystem === 'metric'
      ? `${height.toFixed(1)}m`
      : `${(height * 3.28084).toFixed(1)}ft`

  const formatDirection = (direction: number) => `${direction.toFixed(0)}°`

  const formatSpeed = (speed: number) =>
    unitSystem === 'metric'
      ? `${speed.toFixed(1)}m/s`
      : `${(speed * 2.23694).toFixed(1)}mph`

  const formatTemperature = (temp: number) =>
    unitSystem === 'metric'
      ? `${temp.toFixed(1)}°C`
      : `${((temp * 9) / 5 + 32).toFixed(1)}°F`

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
                      value={`${formatHeight(forecast.waveHeight)} @ ${forecast.wavePeriod?.toFixed(1)}s ${formatDirection(forecast.waveDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.swellHeight)} @ ${forecast.swellPeriod?.toFixed(1)}s ${formatDirection(forecast.swellDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.secondarySwellHeight)} @ ${forecast.secondarySwellPeriod?.toFixed(1)}s ${formatDirection(forecast.secondarySwellDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatHeight(forecast.windWaveHeight)} @ ${forecast.windWavePeriod?.toFixed(1)}s ${formatDirection(forecast.windWaveDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatSpeed(forecast.windSpeed)} (${formatSpeed(forecast.gust)}) ${formatDirection(forecast.windDirection)}`}
                    />
                    <ForecastItem
                      value={`${formatTemperature(forecast.airTemperature)} / ${formatTemperature(forecast.waterTemperature)}`}
                    />
                  </div>
                  <Separator className="my-2" />
                </React.Fragment>
              ))}
            </div>
            <TideChart data={day.tides} />
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 font-medium leading-none">
              Tide range:{' '}
              {formatHeight(Math.min(...day.tides.map((t) => t.height)))} -{' '}
              {formatHeight(Math.max(...day.tides.map((t) => t.height)))}
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
