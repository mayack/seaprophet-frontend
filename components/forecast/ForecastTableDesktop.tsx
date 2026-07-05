import { SwellItem, TemperatureItem, WaveItem, WindItem } from './CellItems'
import type { ForecastDay } from '@/api/polvo/interfaces/forecast'
import { ForecastHeader } from './ForecastHeader'
import type { UserUnits } from '@/api/sargo/interfaces/user'
import { cn } from '@/lib/utils'
import React from 'react'

interface ForecastTableDesktopProps {
  day: ForecastDay
  units: UserUnits
  /** Bucket time ("09:00") to highlight as "now" — today's table only. */
  currentHour?: string
}

export function ForecastTableDesktop({
  day,
  units,
  currentHour,
}: ForecastTableDesktopProps): React.JSX.Element {
  return (
    <div className="relative flex-1">
      <ForecastHeader />
      {Object.entries(day.forecast).map(([hour, forecast]) => (
        <div
          key={hour}
          className="flex h-10 items-center justify-between border-t border-border/50"
        >
          <div
            className={cn(
              'flex h-10 w-3 items-center text-2xs/[1]',
              hour === currentHour
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {hour.slice(0, 2)}
          </div>
          <WaveItem
            className="w-26"
            height={forecast.waveHeight}
            unit={units.surf_height}
            energy={forecast.waveEnergy}
          />
          <SwellItem
            className="w-19"
            height={forecast.swellHeight}
            period={forecast.swellPeriod}
            direction={forecast.swellDirection}
            unit={units.swell_height}
          />
          <SwellItem
            className="w-19"
            height={forecast.secondarySwellHeight}
            period={forecast.secondarySwellPeriod}
            direction={forecast.secondarySwellDirection}
            unit={units.swell_height}
          />
          <SwellItem
            className="w-19"
            height={forecast.windWaveHeight}
            period={forecast.windWavePeriod}
            direction={forecast.windWaveDirection}
            unit={units.swell_height}
          />
          <WindItem
            className="w-18"
            speed={forecast.windSpeed}
            gust={forecast.gust}
            direction={forecast.windDirection}
            unit={units.wind_speed}
            windRating={forecast.windRating}
          />
          <TemperatureItem
            className="w-13"
            airTemp={forecast.airTemperature}
            weatherType={forecast.weatherType}
            unit={units.temperature}
          />
        </div>
      ))}
    </div>
  )
}
